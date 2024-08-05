import path from 'path';
import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
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
                if (attachment.length < 1) continue;

                const parsed = path.parse(attachment[0].Key);
                items.push({
                    hash: hash,
                    ext: parsed.ext,
                    name: parsed.base,
                    size: attachment[0].Size,
                    created: attachment[0].LastModified
                });
            }

            return res.json({
                total: items.length,
                items
            });
        } catch (err) {
            return Err.respond(err, res);
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

            const stream = await S3.get(attachment[0].Key);

            stream.pipe(res);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
