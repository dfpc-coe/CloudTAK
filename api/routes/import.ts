import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import { GenericListOrder } from '@openaddresses/batch-generic';
import path from 'node:path';
import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
import Config from '../lib/config.js';
import S3 from '../lib/aws/s3.js'
import crypto from 'node:crypto';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import { ImportResponse } from '../lib/types.js';
import { Import } from '../lib/schema.js';

export enum ImportModeEnum {
    UNKNOWN = 'Unknown',
    MISSION = 'Mission',
    PACKAGE = 'Package'
}

export default async function router(schema: Schema, config: Config) {
    await schema.post('/import', {
        name: 'Import',
        group: 'Import',
        description: 'Import an unknown asset into the imports manager',
        body: Type.Object({
            name: Type.String(),
            mode: Type.Optional(Type.Enum(ImportModeEnum)),
            mode_id: Type.Optional(Type.String()),
            config: Type.Optional(Type.Any()),
        }),
        res: ImportResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const imp = await config.models.Import.generate({
                id: crypto.randomUUID(),
                name: req.body.name,
                username: user.email,
                status: 'Empty',
                mode: req.body.mode,
                mode_id: req.body.mode_id,
                config: req.body.config
            });

            return res.json(imp)
        } catch (err) {
            return Err.respond(err, res);
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

            if (imported.status !== 'Empty') throw new Err(400, null, 'An asset is already associated with this import');
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
                        status: 'Pending'
                    });
                    await S3.put(`import/${imported.id}${res.ext}`, file)

                    return res;
                })())
            }).on('finish', async () => {
                try {
                    return res.json(imported)
                } catch (err) {
                    Err.respond(err, res);
                }
            });

            return req.pipe(bb);
        } catch (err) {
            return Err.respond(err, res);
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
                    return res.json({
                        imports: await Promise.all(uploads)
                    });
                } catch (err) {
                    Err.respond(err, res);
                }
            });

            return req.pipe(bb);
        } catch (err) {
            return Err.respond(err, res);
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
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.IMPORT, id: req.params.import }]
            });

            const imported = await config.models.Import.from(req.params.import);

            return res.json(imported);
        } catch (err) {
            return Err.respond(err, res);
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
            status: Type.Optional(Type.String()),
            error: Type.Optional(Type.String()),
            result: Type.Optional(Type.Any())
        }),
        res: ImportResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.IMPORT, id: req.params.import }]
            });

            const imported = await config.models.Import.commit(req.params.import, {
                ...req.body,
                updated: sql`Now()`
            });

            return res.json(imported);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/import', {
        name: 'List Imports',
        group: 'Import',
        description: 'List Imports',
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Import) })),
            mode: Type.Optional(Type.String()),
            mode_id: Type.Optional(Type.String())
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ImportResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const list = await config.models.Import.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    (${Param(req.query.mode)}::TEXT IS NULL OR ${Param(req.query.mode)}::TEXT = mode)
                    AND (${Param(req.query.mode_id)}::TEXT IS NULL OR ${Param(req.query.mode_id)}::TEXT = mode_id)
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

