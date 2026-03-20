import path from 'node:path';
import Stream from 'node:stream';
import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Busboy } from '@fastify/busboy';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    await schema.post('/server/tileset', {
        name: 'Upload Hosted Tileset',
        group: 'ServerTilesets',
        description: 'Upload a hosted PMTiles tileset into the public asset prefix',
        res: Type.Object({
            status: Type.Integer(),
            message: Type.String(),
            name: Type.String(),
            path: Type.String()
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });
            const contentType = req.headers['content-type'];

            if (
                !contentType
                || !contentType.startsWith('multipart/form-data')
            ) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const bb = new Busboy({
                headers: {
                    'content-type': contentType
                },
                limits: {
                    files: 1
                }
            });

            let handled = false;
            let uploadPromise: Promise<void> | undefined;
            let uploadError: Error | undefined;
            let uploadName = '';
            let passThrough: Stream.PassThrough | undefined;

            function respond(err: unknown) {
                if (handled || res.headersSent) return;
                handled = true;

                req.unpipe(bb);
                req.resume();

                const wrapped = err instanceof Err
                    ? err
                    : new Err(400, err instanceof Error ? err : new Error(String(err)), 'Malformed multipart upload');

                if (passThrough && !passThrough.destroyed) {
                    passThrough.destroy(wrapped);
                }

                Err.respond(wrapped, res);
            }

            bb.on('file', (fieldname, file, filename) => {
                try {
                    const parsed = path.parse(path.basename(filename || ''));
                    if (!parsed.name) throw new Err(400, null, 'Uploaded file must have a filename');
                    if (parsed.ext.toLowerCase() !== '.pmtiles') throw new Err(400, null, 'Only .pmtiles files can be uploaded');

                    const sanitized = parsed.name
                        .trim()
                        .replace(/[^a-zA-Z0-9._-]+/g, '-')
                        .replace(/^-+/g, '')
                        .replace(/-+$/g, '');

                    if (!sanitized) throw new Err(400, null, 'Filename must contain at least one alphanumeric character');

                    uploadName = `${sanitized}.pmtiles`;

                    passThrough = new Stream.PassThrough();
                    file.pipe(passThrough);
                    uploadPromise = S3.put(`public/${uploadName}`, passThrough);
                } catch (err) {
                    uploadError = err instanceof Error ? err : new Error(String(err));
                    file.resume();
                }
            }).on('error', (err) => {
                respond(err);
            }).on('finish', async () => {
                try {
                    if (handled) return;
                    if (uploadError) throw uploadError;
                    if (!uploadPromise || !uploadName) throw new Err(400, null, 'No Asset Provided');

                    await uploadPromise;

                    handled = true;

                    res.json({
                        status: 200,
                        message: 'Hosted Tileset Uploaded',
                        name: uploadName,
                        path: `public/${uploadName}`
                    });
                } catch (err) {
                    respond(err);
                }
            });

            req.pipe(bb);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
