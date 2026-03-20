import path from 'node:path';
import Stream from 'node:stream';
import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
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
        let bb;
        try {
            await Auth.as_user(config, req, { admin: true });

            if (!req.headers['content-type']) throw new Err(400, null, 'Missing Content-Type Header');

            bb = busboy({
                headers: req.headers,
                limits: {
                    files: 1
                }
            });

            let uploadPromise: Promise<void> | undefined;
            let uploadError: Error | undefined;
            let uploadName = '';

            bb.on('file', (fieldname, file, blob) => {
                try {
                    const parsed = path.parse(path.basename(blob.filename || ''));
                    if (!parsed.name) throw new Err(400, null, 'Uploaded file must have a filename');
                    if (parsed.ext.toLowerCase() !== '.pmtiles') throw new Err(400, null, 'Only .pmtiles files can be uploaded');

                    const sanitized = parsed.name
                        .trim()
                        .replace(/[^a-zA-Z0-9._-]+/g, '-')
                        .replace(/^-+/g, '')
                        .replace(/-+$/g, '');

                    if (!sanitized) throw new Err(400, null, 'Filename must contain at least one alphanumeric character');

                    uploadName = `${sanitized}.pmtiles`;

                    const passThrough = new Stream.PassThrough();
                    file.pipe(passThrough);
                    uploadPromise = S3.put(`public/${uploadName}`, passThrough);
                } catch (err) {
                    uploadError = err instanceof Error ? err : new Error(String(err));
                    file.resume();
                }
            }).on('finish', async () => {
                try {
                    if (uploadError) throw uploadError;
                    if (!uploadPromise || !uploadName) throw new Err(400, null, 'No Asset Provided');

                    await uploadPromise;

                    res.json({
                        status: 200,
                        message: 'Hosted Tileset Uploaded',
                        name: uploadName,
                        path: `public/${uploadName}`
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
}
