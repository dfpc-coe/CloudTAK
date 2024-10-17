import path from 'path';
import busboy from 'busboy';
import { Type } from '@sinclair/typebox'
import AttachmentControl from '../lib/control/attachment.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    const attachmentControl = new AttachmentControl(config);

    await schema.get('/attachment', {
        name: 'List Attachments',
        group: 'Attachments',
        description: 'Attachments',
        query: Type.Object({
            hash: Type.Union([Type.String(), Type.Array(Type.String())])
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                hash: Type.String(),
                ext: Type.String(),
                name: Type.String(),
                size: Type.Integer(),
                created: Type.String()
            }))
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const items = [];
            for (const hash of Array.isArray(req.query.hash) ? req.query.hash : [req.query.hash]) {
                const attachment = await S3.list(`attachment/${hash}/`);
                if (attachment.length < 1 || !attachment[0].Key) continue;

                const parsed = path.parse(attachment[0].Key);
                items.push({
                    hash: hash,
                    ext: parsed.ext,
                    name: parsed.base,
                    size: attachment[0].Size || 0,
                    created: (attachment[0].LastModified || new Date()).toISOString()
                });
            }

            res.json({
                total: items.length,
                items
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/attachment', {
        name: 'Upload Attachment',
        group: 'Attachments',
        description: 'Upload an attachment that is assigned to a given CoT',
        res: Type.Object({
            hash: Type.String()
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            if (
                !req.headers['content-type']
                || !req.headers['content-type'].startsWith('multipart/form-data')
            ) {
                throw new Err(400, null, 'Unsupported Content-Type');
            }

            const bb = busboy({
                headers: req.headers,
                limits: { files: 1 }
            });

            const uploads: Promise<{
                hash: string;
            }>[] = [];

            bb.on('file', async (fieldname, file, blob) => {
                uploads.push(attachmentControl.upload(blob.filename, file));
            }).on('finish', async () => {
                try {
                    const files = await Promise.all(uploads);

                    res.json({
                        ...files[0]
                    })
                } catch (err) {
                    Err.respond(err, res);
                }
            });

            req.pipe(bb);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/attachment/:hash', {
        name: 'Get Attachment',
        group: 'Attachments',
        description: 'Attachments',
        params: Type.Object({
            hash: Type.String()
        }),
        query: Type.Object({
            token: Type.Optional(Type.String())
        }),
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, { token: true });

            const attachment = await S3.list(`attachment/${req.params.hash}/`);
            if (attachment.length < 1) throw new Err(404, null, 'Attachment not found');

            if (!attachment[0].Key) throw new Err(400, null, 'Count not find attachment');
            const stream = await S3.get(attachment[0].Key);

            stream.pipe(res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
