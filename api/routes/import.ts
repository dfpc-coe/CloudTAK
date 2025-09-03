import ImportControl, { ImportSourceEnum } from '../lib/control/import.js';
import { Type } from '@sinclair/typebox'
import path from 'node:path';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Param } from '@openaddresses/batch-generic';
import busboy from 'busboy';
import Config from '../lib/config.js';
import S3 from '../lib/aws/s3.js'
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import Auth, { AuthResourceAccess, AuthUser } from '../lib/auth.js';
import { ImportResponse, StandardResponse } from '../lib/types.js';
import { Import_Status } from '../lib/enums.js';
import { Import } from '../lib/schema.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const importControl = new ImportControl(config);

    await schema.get('/import', {
        name: 'List Imports',
        group: 'Import',
        description: 'List Imports',
        query: Type.Object({
            limit: Default.Limit,
            impersonate: Type.Optional(Type.Union([
                Type.Boolean({ description: 'List all of the given resource, regardless of ACL' }),
                Type.String({ description: 'Filter the given resource by a given username' }),
            ])),
            page: Default.Page,
            filter: Default.Filter,
            order: Default.Order,
            status: Type.Optional(Type.Enum(Import_Status)),
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Import)
            }),
            source: Type.Optional(Type.Enum(ImportSourceEnum)),
            source_id: Type.Optional(Type.String())
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ImportResponse)
        })
    }, async (req, res) => {
        try {
            let list;

            if (req.query.impersonate) {
                await Auth.as_user(config, req, { admin: true });

                const impersonate: string | null = req.query.impersonate === true ? null : req.query.impersonate;

                list = await config.models.Import.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        (${impersonate}::TEXT IS NULL OR username = ${impersonate}::TEXT)
                        AND (${Param(req.query.status)}::TEXT IS NULL OR ${Param(req.query.status)}::TEXT = status)
                        AND (${Param(req.query.source)}::TEXT IS NULL OR ${Param(req.query.source)}::TEXT = source)
                        AND (${Param(req.query.source_id)}::TEXT IS NULL OR ${Param(req.query.source_id)}::TEXT = source_id)
                        AND (
                            ${Param(req.query.filter)}::TEXT IS NULL
                            OR ${Param(req.query.filter)}::TEXT = ''
                            OR ${Param(req.query.filter)}::TEXT ~* name
                        )
                    `
                });
            } else {
                const auth = await Auth.is_auth(config, req, {
                    resources: [{ access: AuthResourceAccess.IMPORT }]
                });

                const username = auth instanceof AuthUser ? auth.email : null;

                list = await config.models.Import.list({
                    limit: req.query.limit,
                    page: req.query.page,
                    order: req.query.order,
                    sort: req.query.sort,
                    where: sql`
                        (${Param(username)}::TEXT IS NULL OR username = ${username}::TEXT)
                        AND (${Param(req.query.status)}::TEXT IS NULL OR ${Param(req.query.status)}::TEXT = status)
                        AND (${Param(req.query.source)}::TEXT IS NULL OR ${Param(req.query.source)}::TEXT = source)
                        AND (${Param(req.query.source_id)}::TEXT IS NULL OR ${Param(req.query.source_id)}::TEXT = source_id)
                        AND (
                            ${Param(req.query.filter)}::TEXT IS NULL
                            OR ${Param(req.query.filter)}::TEXT = ''
                            OR ${Param(req.query.filter)}::TEXT ~* name
                        )
                    `
                });
            }

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/import', {
        name: 'Import',
        group: 'Import',
        description: 'Import an unknown asset into the imports manager',
        body: Type.Object({
            name: Default.NameField,
            source: Type.Optional(Type.Enum(ImportSourceEnum)),
            source_id: Type.Optional(Type.String()),
            config: Type.Optional(Type.Any()),
        }),
        res: ImportResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const imp = await importControl.create({
                ...req.body,
                username: user.email
            })

            res.json(imp)
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/import/:import', {
        name: 'Import',
        group: 'Import',
        params: Type.Object({
            import: Type.String()
        }),
        description: 'Import an asset into a previously configured import container',
        res: ImportResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (!req.headers['content-type'] || !req.headers['content-type'].startsWith('multipart/form-data')) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const imported = await config.models.Import.from(req.params.import);

            if (imported.status !== Import_Status.EMPTY) throw new Err(400, null, 'An asset is already associated with this import');
            if (imported.username !== user.email) throw new Err(400, null, 'You did not create this import');

            const bb = busboy({
                headers: req.headers,
                limits: { files: 1 }
            });

            const uploads: Promise<unknown>[] = [];
            bb.on('file', async (fieldname, file, blob) => {
                uploads.push((async function() {
                    const res = {
                        file: blob.filename,
                        ext: path.parse(blob.filename).ext,
                    };

                    await config.models.Import.commit(imported.id, {
                        status: Import_Status.PENDING,
                    });

                    await S3.put(`import/${imported.id}${res.ext}`, file)

                    return res;
                })())
            }).on('finish', async () => {
                try {
                    res.json(imported)
                } catch (err) {
                    Err.respond(err, res);
                }
            });

            req.pipe(bb);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/import', {
        name: 'Import',
        group: 'Import',
        description: 'Import up to 5 unknown assets into the imports manager at a time',
        res: Type.Object({
            imports: Type.Array(Type.Object({
                file: Type.String(),
                uid: Type.String(),
                ext: Type.String()
            }))
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (!req.headers['content-type'] || !req.headers['content-type'].startsWith('multipart/form-data')) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const bb = busboy({
                headers: req.headers,
                limits: { files: 5 }
            });

            const uploads: Promise<{
                file: string;
                uid: string;
                ext: string;
            }>[] = [];
            bb.on('file', async (fieldname, file, blob) => {
                uploads.push((async function() {
                    const res = {
                        file: blob.filename,
                        ext: path.parse(blob.filename).ext,
                        uid: crypto.randomUUID()
                    };

                    await config.models.Import.generate({
                        name: res.file,
                        username: user.email,
                        id: res.uid
                    });

                    await S3.put(`import/${res.uid}${res.ext}`, file)

                    return res;
                })())
            }).on('finish', async () => {
                try {
                    res.json({
                        imports: await Promise.all(uploads)
                    });
                } catch (err) {
                    Err.respond(err, res);
                }
            });

            req.pipe(bb);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/import/:import', {
        name: 'Get Import',
        group: 'Import',
        description: 'Get Import',
        params: Type.Object({
            import: Type.String()
        }),
        res: ImportResponse
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.IMPORT, id: req.params.import }]
            });

            const imported = await config.models.Import.from(req.params.import);

            if (auth instanceof AuthUser) {
                const user = auth as AuthUser;
                if (imported.username !== user.email) throw new Err(400, null, 'You did not create this import');
            }

            res.json(imported);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/import/:import/raw', {
        name: 'Download Import',
        group: 'Import',
        description: 'Download Import File',
        query: Type.Object({
            download: Type.Boolean({
                default: false,
                description: 'Set the Content-Disposition Header'
            }),
            token: Type.Optional(Type.String())
        }),
        params: Type.Object({
            import: Type.String()
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const imp = await config.models.Import.from(req.params.import);

            if (imp.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to download this import');
            }

            const stream = await S3.get(`import/${req.params.import}${path.parse(imp.name).ext}`);

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="import-${imp.id}-${imp.name}"`);
            }

            stream.pipe(res);
        } catch (err) {
             Err.respond(err, res);
        }
    });


    await schema.patch('/import/:import', {
        name: 'Update Import',
        group: 'Import',
        description: 'Update Import',
        params: Type.Object({
            import: Type.String()
        }),
        body: Type.Object({
            status: Type.Optional(Type.Enum(Import_Status)),
            error: Type.Optional(Type.String()),
            result: Type.Optional(Type.Any())
        }),
        res: ImportResponse
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.IMPORT, id: req.params.import }]
            });

            let imported = await config.models.Import.from(req.params.import);

            if (auth instanceof AuthUser) {
                const user = auth as AuthUser;
                if (imported.username !== user.email) throw new Err(400, null, 'You did not create this import');
            }

            if (req.body.status && [Import_Status.EMPTY, Import_Status.PENDING].includes(req.body.status)) {
                throw new Err(400, null, `Cannot set status to ${req.body.status}`);
            } else if (req.body.status === Import_Status.RUNNING && imported.status === Import_Status.RUNNING) {
                throw new Err(400, null, `Cannot set statust to running on an import that is already running`);
            }

            imported = await config.models.Import.commit(req.params.import, {
                ...req.body,
                updated: sql`Now()`
            });

            res.json(imported);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/import/:import', {
        name: 'Delete Import',
        group: 'Import',
        description: 'Delete Import',
        params: Type.Object({
            import: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const auth = await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.IMPORT, id: req.params.import }]
            });

            const imported = await config.models.Import.from(req.params.import);

            if (auth instanceof AuthUser) {
                const user = auth as AuthUser;
                if (imported.username !== user.email) throw new Err(400, null, 'You did not create this import');
            }

            const ext = path.parse(imported.name).ext
            await S3.del(`import/${imported.id}${ext}`)

            await config.models.Import.delete(req.params.import);

            res.json({
                status: 200,
                message: 'Import Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

}

