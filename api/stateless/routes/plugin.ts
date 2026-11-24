import path from 'node:path';
import Stream from 'node:stream';
import { createHash } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Param } from '@openaddresses/batch-generic';
import { Busboy } from '@fastify/busboy';
import Auth, { AuthUserAccess } from '../../common/auth.js';
import S3 from '../../common/aws/s3.js';
import type ConfigStateless from '../config.js';
import { Plugin } from '../../common/schema.js';
import { PluginResponse, StandardResponse } from '../../common/types.js';
import * as Default from '../lib/limits.js';

const BUNDLE_MAX_BYTES = 25 * 1024 * 1024;

const PluginVersion = Type.String({
    minLength: 1,
    maxLength: 64,
    pattern: '^[a-zA-Z0-9][a-zA-Z0-9._+-]*$',
    description: 'Version of the Plugin bundle',
});

const PluginApiVersion = Type.Integer({
    minimum: 1,
    description: 'Version of the CloudTAK Plugin API the bundle was built against',
});

function bundleKey(id: string, version: string): string {
    return `plugin/${id}/${version}/index.js`;
}

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/plugin', {
        name: 'List Plugins',
        group: 'Plugin',
        description: 'List Plugins. Only System Administrators are shown disabled Plugins',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'name',
                enum: Object.keys(Plugin),
            }),
            filter: Default.Filter,
            enabled: Type.Optional(Type.Boolean({
                description: 'Filter by enabled state',
            })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(PluginResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const enabled = user.access === AuthUserAccess.ADMIN ? req.query.enabled : true;

            const list = await config.models.Plugin.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${Param(enabled)}::BOOLEAN IS NULL OR ${Param(enabled)}::BOOLEAN = enabled)
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/plugin/:plugin', {
        name: 'Get Plugin',
        group: 'Plugin',
        description: 'Get a Plugin',
        params: Type.Object({
            plugin: Type.String({ format: 'uuid' }),
        }),
        res: PluginResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const plugin = await config.models.Plugin.from(req.params.plugin);

            if (!plugin.enabled && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(404, null, 'Plugin Not Found');
            }

            res.json(plugin);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/plugin', {
        name: 'Create Plugin',
        group: 'Plugin',
        description: 'Create a Plugin. It stays disabled until a bundle is uploaded and it is enabled',
        body: Type.Object({
            name: Default.NameField,
            description: Type.Optional(Default.DescriptionField),
            api_version: Type.Optional(PluginApiVersion),
        }),
        res: PluginResponse,
        security: Auth.security({ admin: true }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const plugin = await config.models.Plugin.generate({
                ...req.body,
                username: user.email,
            });

            res.json(plugin);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/plugin/:plugin', {
        name: 'Update Plugin',
        group: 'Plugin',
        description: 'Update a Plugin',
        params: Type.Object({
            plugin: Type.String({ format: 'uuid' }),
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            description: Type.Optional(Default.DescriptionField),
            api_version: Type.Optional(PluginApiVersion),
            enabled: Type.Optional(Type.Boolean()),
        }),
        res: PluginResponse,
        security: Auth.security({ admin: true }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const existing = await config.models.Plugin.from(req.params.plugin);

            if (req.body.enabled && !existing.sha256) {
                throw new Err(400, null, 'A bundle must be uploaded before a Plugin can be enabled');
            }

            const plugin = await config.models.Plugin.commit(existing.id, {
                ...req.body,
                updated: sql`Now()`,
            });

            res.json(plugin);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/plugin/:plugin', {
        name: 'Delete Plugin',
        group: 'Plugin',
        description: 'Delete a Plugin and its bundles',
        params: Type.Object({
            plugin: Type.String({ format: 'uuid' }),
        }),
        res: StandardResponse,
        security: Auth.security({ admin: true }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const plugin = await config.models.Plugin.from(req.params.plugin);

            await S3.del(`plugin/${plugin.id}/`, { recurse: true });
            await config.models.Plugin.delete(plugin.id);

            res.json({
                status: 200,
                message: 'Plugin Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/plugin/:plugin/bundle', {
        name: 'Upload Bundle',
        group: 'Plugin',
        description: 'Upload a new version of the Plugin bundle as a single ES module',
        params: Type.Object({
            plugin: Type.String({ format: 'uuid' }),
        }),
        query: Type.Object({
            version: PluginVersion,
        }),
        body: {
            'multipart/form-data': true,
        },
        res: PluginResponse,
        security: Auth.security({ admin: true }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const existing = await config.models.Plugin.from(req.params.plugin);
            const version = req.query.version;

            if (existing.version === version) {
                throw new Err(400, null, `Version ${version} has already been uploaded`);
            }

            const contentType = req.headers['content-type'];

            if (
                !contentType
                || !contentType.startsWith('multipart/form-data')
            ) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const bb = new Busboy({
                headers: {
                    'content-type': contentType,
                },
                limits: {
                    files: 1,
                    fileSize: BUNDLE_MAX_BYTES,
                },
            });

            const key = bundleKey(existing.id, version);
            const hash = createHash('sha256');
            let size = 0;

            let handled = false;
            let uploadPromise: Promise<void> | undefined;
            let uploadError: Error | undefined;
            let meter: Stream.Transform | undefined;

            function respond(err: unknown) {
                if (handled || res.headersSent) return;
                handled = true;

                req.unpipe(bb);
                req.resume();

                const wrapped = err instanceof Err
                    ? err
                    : new Err(400, err instanceof Error ? err : new Error(String(err)), 'Malformed multipart upload');

                if (meter && !meter.destroyed) {
                    meter.destroy(wrapped);
                }

                Err.respond(wrapped, res);
            }

            bb.on('file', (fieldname, file, filename) => {
                try {
                    const ext = path.parse(path.basename(filename || '')).ext.toLowerCase();
                    if (!['.js', '.mjs'].includes(ext)) throw new Err(400, null, 'Only .js or .mjs bundles can be uploaded');

                    file.on('limit', () => {
                        uploadError = new Err(400, null, `Bundle exceeds ${BUNDLE_MAX_BYTES} bytes`);
                    });

                    meter = new Stream.Transform({
                        transform(chunk: Buffer, encoding, callback) {
                            hash.update(chunk);
                            size += chunk.length;
                            callback(null, chunk);
                        },
                    });

                    file.pipe(meter);
                    uploadPromise = S3.put(key, meter);
                } catch (err) {
                    uploadError = err instanceof Error ? err : new Error(String(err));
                    file.resume();
                }
            }).on('error', (err) => {
                respond(err);
            }).on('finish', async () => {
                try {
                    if (handled) return;
                    if (!uploadPromise && !uploadError) throw new Err(400, null, 'No Bundle Provided');

                    if (uploadPromise) await uploadPromise;

                    if (uploadError) {
                        if (uploadPromise) await S3.del(key);
                        throw uploadError;
                    }

                    if (!size) {
                        await S3.del(key);
                        throw new Err(400, null, 'Bundle is empty');
                    }

                    const plugin = await config.models.Plugin.commit(existing.id, {
                        version,
                        sha256: hash.digest('hex'),
                        size,
                        username: user.email,
                        updated: sql`Now()`,
                    });

                    if (existing.version) {
                        await S3.del(`plugin/${existing.id}/${existing.version}/`, { recurse: true });
                    }

                    handled = true;

                    res.json(plugin);
                } catch (err) {
                    respond(err);
                }
            });

            req.pipe(bb);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/plugin/:plugin/bundle', {
        name: 'Get Bundle',
        group: 'Plugin',
        description: 'Get the ES module bundle of a Plugin. Passing the current sha256 makes the response immutably cacheable',
        params: Type.Object({
            plugin: Type.String({ format: 'uuid' }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            sha256: Type.Optional(Type.String()),
        }),
        security: Auth.security({ token: true }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const plugin = await config.models.Plugin.from(req.params.plugin);

            if (!plugin.enabled && user.access !== AuthUserAccess.ADMIN) {
                throw new Err(404, null, 'Plugin Not Found');
            }

            if (!plugin.version || !plugin.sha256) {
                throw new Err(404, null, 'Plugin has no bundle');
            }

            if (req.query.sha256 && req.query.sha256 !== plugin.sha256) {
                throw new Err(404, null, 'Plugin bundle has changed');
            }

            res.set('ETag', `"${plugin.sha256}"`);
            res.set('Cache-Control', req.query.sha256 ? 'private, max-age=31536000, immutable' : 'private, no-cache');

            if (req.headers['if-none-match'] === `"${plugin.sha256}"`) {
                res.status(304).end();
                return;
            }

            const object = await S3.getObject(bundleKey(plugin.id, plugin.version));

            if (object.contentLength !== undefined) res.set('Content-Length', String(object.contentLength));
            res.set('Content-Type', 'text/javascript; charset=utf-8');

            object.body.pipe(res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
