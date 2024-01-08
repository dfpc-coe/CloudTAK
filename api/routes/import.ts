import path from 'node:path';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.ts';
import busboy from 'busboy';
import Config from '../lib/config.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { Import } from '../lib/schema.ts';
import S3 from '../lib/aws/s3.ts'
import crypto from 'node:crypto';
import Modeler from '../lib/drizzle.ts';
import { type InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export default async function router(schema: any, config: Config) {
    const ImportModel = new Modeler<InferSelectModel<typeof Import>>(config.pg, Import);

    await schema.post('/import', {
        name: 'Import',
        group: 'Import',
        auth: 'user',
        description: 'Import an unknown asset into the imports manager',
        body: {
            type: 'object',
            required: ['name'],
            additionalProperties: false,
            properties: {
                name: { type: 'string' },
                mode: {
                    type: 'string',
                    default: 'Unknown',
                    description: 'Import to a given subasset or attempt to determine where to import',
                    enum: [
                        'Unknown',
                        'Mission'
                    ]
                },
                mode_id: {
                    type: 'string',
                    description: 'ID of the subasset if given - don\'t set for an unknown mode'
                },
                config: {
                    type: 'object'
                }
            }
        },
        res: "imports.json"
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const imp = await ImportModel.generate({
                id: crypto.randomUUID(),
                name: req.body.name,
                username: req.auth.email,
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
        auth: 'user',
        ':import': 'string',
        description: 'Import an asset into a previously configured import container',
        res: 'imports.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!req.headers['content-type'].startsWith('multipart/form-data')) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const imported = await ImportModel.from(String(req.params.import));

            if (imported.status !== 'Empty') throw new Err(400, null, 'An asset is already associated with this import');
            if (imported.username !== req.auth.email) throw new Err(400, null, 'You did not create this import');

            const bb = busboy({
                headers: req.headers,
                limits: { files: 1 }
            });

            const uploads = [];
            bb.on('file', async (fieldname, file, blob) => {
                uploads.push((async function() {
                    const res = {
                        file: blob.filename,
                        ext: path.parse(blob.filename).ext,
                    };

                    await ImportModel.commit(imported.id, {
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
        auth: 'user',
        description: 'Import up to 5 unknown assets into the imports manager at a time',
        res: {
            type: 'object',
            required: ['imports'],
            additionalProperties: false,
            properties: {
                imports: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['file', 'uid', 'ext'],
                        additionalProperties: false,
                        properties: {
                            file: {
                                type: 'string'
                            },
                            uid: {
                                type: 'string'
                            },
                            ext: {
                                type: 'string'
                            }
                        }
                    }
                }
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!req.headers['content-type'].startsWith('multipart/form-data')) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const bb = busboy({
                headers: req.headers,
                limits: { files: 5 }
            });

            const uploads = [];
            bb.on('file', async (fieldname, file, blob) => {
                uploads.push((async function() {
                    const res = {
                        file: blob.filename,
                        ext: path.parse(blob.filename).ext,
                        uid: crypto.randomUUID()
                    };

                    await ImportModel.generate({
                        name: res.file,
                        username: req.auth.email,
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
        auth: 'user',
        description: 'Get Import',
        ':import': 'string',
        res: 'imports.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const imported = await ImportModel.from(String(req.params.import));

            return res.json(imported);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/import/:import', {
        name: 'Update Import',
        group: 'Import',
        auth: 'user',
        description: 'Update Import',
        ':import': 'string',
        body: 'req.body.PatchImport.json',
        res: 'imports.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const imported = await ImportModel.commit(String(req.params.import), {
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
        auth: 'user',
        description: 'List Imports',
        query: 'req.query.ListImports.json',
        res: 'res.ListImports.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await ImportModel.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    (${req.query.mode}::TEXT IS NULL OR ${req.query.mode}::TEXT = mode)
                    AND (${req.query.mode_id}::TEXT IS NULL OR ${req.query.mode_id}::TEXT = mode_id)
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

