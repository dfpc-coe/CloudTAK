import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { Busboy } from '@fastify/busboy';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Stream from 'node:stream';
import assetList, { AssetOutput } from '../lib/asset.js';
import Config from '../lib/config.js';
import { StandardResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/asset', {
        name: 'List Assets',
        group: 'ConnectionAssets',
        description: 'List Assets',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 0 }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(AssetOutput),
        }),
    }, async (req, res) => {
        try {
            if (req.params.connectionid === 0) {
                await Auth.as_user(config, req, { admin: true });
            } else {
                const { connection } = await Auth.is_connection(config, req, {
                    resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }],
                }, req.params.connectionid);

                if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            }

            const list = await assetList(config, `connection/${String(req.params.connectionid)}/`);

            res.json({
                total: list.total,
                items: list.assets,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/asset', {
        name: 'Create Asset',
        group: 'ConnectionAssets',
        description: 'Create a new asset',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 0 }),
        }),
        body: {
            'multipart/form-data': true,
        },
        res: StandardResponse,
    }, async (req, res) => {
        try {
            if (req.params.connectionid === 0) {
                await Auth.as_user(config, req, { admin: true });
            } else {
                const { connection } = await Auth.is_connection(config, req, {
                    resources: [
                        { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    ],
                }, req.params.connectionid);

                if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            }

            const contentType = req.headers['content-type'];

            if (!contentType) throw new Err(400, null, 'Missing Content-Type Header');

            const bb = new Busboy({
                headers: {
                    'content-type': contentType,
                },
                limits: {
                    files: 1,
                },
            });

            const assets: Promise<void>[] = [];
            bb.on('file', async (fieldname, file, filename) => {
                try {
                    const passThrough = new Stream.PassThrough();
                    file.pipe(passThrough);

                    assets.push(S3.put(`connection/${req.params.connectionid}/${filename}`, passThrough));
                } catch (err) {
                    Err.respond(err, res);
                }
            }).on('finish', async () => {
                try {
                    if (!assets.length) throw new Err(400, null, 'No Asset Provided');

                    await assets[0];

                    res.json({
                        status: 200,
                        message: 'Asset Uploaded',
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

    await schema.delete('/connection/:connectionid/asset/:asset.:ext', {
        name: 'Delete Asset',
        group: 'ConnectionAssets',
        description: 'Delete Asset',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 0 }),
            asset: Type.String(),
            ext: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            if (req.params.connectionid === 0) {
                await Auth.as_user(config, req, { admin: true });
            } else {
                const { connection } = await Auth.is_connection(config, req, {
                    resources: [
                        { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    ],
                }, req.params.connectionid);

                if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            }

            const file = `${req.params.asset}.${req.params.ext}`;

            const list = await assetList(config, `connection/${String(req.params.connectionid)}/`);
            for (const asset of list.assets) {
                if (asset.name !== file) continue;

                await S3.del(`connection/${req.params.connectionid}/${file}`);
            }

            res.json({
                status: 200,
                message: 'Asset Deleted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/asset/:asset.:ext', {
        name: 'Raw Asset',
        group: 'ConnectionAssets',
        description: 'Get single raw asset',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 0 }),
            asset: Type.String(),
            ext: Type.String(),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            download: Type.Boolean(),
        }),
    }, async (req, res) => {
        try {
            if (req.params.connectionid === 0) {
                await Auth.as_user(config, req, { admin: true, token: true });
            } else {
                const { connection } = await Auth.is_connection(config, req, {
                    token: true,
                    resources: [
                        { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    ],
                }, req.params.connectionid);

                if (connection.readonly) throw new Err(400, null, 'Connection is Read-Only mode');
            }

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="${req.params.asset}.${req.params.ext}"`);
            }

            const stream = await S3.get(`connection/${req.params.connectionid}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
