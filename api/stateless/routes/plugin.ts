import Stream from 'node:stream';
import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Param } from '@openaddresses/batch-generic';
import Auth, { AuthUserAccess } from '../../common/auth.js';
import S3 from '../../common/aws/s3.js';
import type ConfigStateless from '../config.js';
import { Plugin } from '../../common/schema.js';
import { PluginResponse, StandardResponse } from '../../common/types.js';
import * as Default from '../lib/limits.js';
import { readUpload, PLUGIN_API_VERSION } from '../lib/plugin-bundle.js';

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

    await schema.patch('/plugin/:plugin', {
        name: 'Update Plugin',
        group: 'Plugin',
        description: 'Enable or disable a Plugin',
        params: Type.Object({
            plugin: Type.String({ format: 'uuid' }),
        }),
        body: Type.Object({
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

    await schema.post('/plugin/bundle', {
        name: 'Upload Bundle',
        group: 'Plugin',
        description: 'Upload a Plugin bundle as a .tar.gz containing manifest.json and index.js. Creates the Plugin named in the manifest or replaces its current version',
        body: {
            'multipart/form-data': true,
        },
        res: PluginResponse,
        security: Auth.security({ admin: true }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const { manifest, index } = await readUpload(req);

            const existing = (await config.models.Plugin.list({
                limit: 1,
                where: sql`name = ${manifest.name}`,
            })).items[0];

            if (existing?.version === manifest.version) {
                throw new Err(400, null, `${manifest.name} ${manifest.version} has already been uploaded`);
            }

            const id = existing?.id ?? randomUUID();
            const key = bundleKey(id, manifest.version);

            const fields = {
                description: manifest.description ?? '',
                author: manifest.author ?? '',
                license: manifest.license ?? '',
                homepage: manifest.homepage ?? '',
                logo: manifest.logo ?? null,
                api_version: manifest.api_version ?? PLUGIN_API_VERSION,
                version: manifest.version,
                sha256: manifest.sha256,
                size: index.length,
                username: user.email,
            };

            await S3.put(key, Stream.Readable.from([index]));

            let plugin;
            try {
                plugin = existing
                    ? await config.models.Plugin.commit(id, { ...fields, updated: sql`Now()` })
                    : await config.models.Plugin.generate({ id, name: manifest.name, ...fields });
            } catch (err) {
                await S3.del(key);
                throw err;
            }

            if (existing?.version) await S3.del(bundleKey(id, existing.version));

            res.json(plugin);
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
