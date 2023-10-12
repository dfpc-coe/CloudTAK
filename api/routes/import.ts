import path from 'node:path';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import busboy from 'busboy';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Import from '../lib/types/import.js';
import S3 from '../lib/aws/s3.js';
import crypto from 'node:crypto';
import { sql } from 'slonik';

export default async function router(schema: any, config: Config) {
    await schema.put('/import', {
        name: 'Import',
        group: 'Import',
        auth: 'user',
        description: 'Import TAK assets and attempt to automatically handle them',
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
                limits: {
                    files: 1
                }
            });

            let buffer: Buffer;
            const uploads = [];
            bb.on('file', async (fieldname, file, blob) => {
                uploads.push((async function() {
                    const res = {
                        file: blob.filename,
                        ext: path.parse(blob.filename).ext,
                        uid: crypto.randomUUID()
                    };

                    await Import.generate(config.pool, {
                        name: res.file,
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

            const imported = await Import.from(config.pool, req.params.import);

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
        body: 'req.PatchImport.json',
        res: 'imports.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const imported = await Import.commit(config.pool, req.params.import, {
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

            const list = await Import.list(config.pool, req.query);

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}

