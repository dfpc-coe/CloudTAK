import { Static, Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
import Auth, { AuthResourceAccess }  from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Stream from 'node:stream';
import Batch from '../lib/aws/batch.js';
import jwt from 'jsonwebtoken';
import { includesWithGlob } from "array-includes-with-glob";
import assetList from '../lib/asset.js';
import Config from '../lib/config.js';
import DataMission from '../lib/data-mission.js';
import { InferSelectModel } from 'drizzle-orm';
import { Data } from '../lib/schema.js';
import { StandardResponse, AssetResponse, GenericMartiResponse } from '../lib/types.js';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/data/:dataid/asset', {
        name: 'List Assets',
        group: 'DataAssets',
        description: 'List Assets',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        res: Type.Object({
            total: Type.Integer(),
            tiles: Type.Object({
                url: Type.String()
            }),
            assets: Type.Array(AssetResponse)
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const data = await config.models.Data.from(req.params.dataid)
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const list = await assetList(config, `data/${String(req.params.dataid)}/`);

            const assets: Array<Static<typeof AssetResponse>> = list.assets.map((a: any) => {
                a.sync = false;
                if (!data.mission_sync) return a
                for (const glob of data.assets) {
                    a.sync = includesWithGlob([a.name], glob);
                    if (a.sync) break;
                }
                return a;
            });

            return res.json({ ...list, assets });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/data/:dataid/upload', {
        private: true,
        name: 'Internal Upload',
        group: 'DataAssets',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        description: 'Create an upload after the file as been processed by Event Lambda',
        query: Type.Object({
            name: Type.String()
        }),
        res: GenericMartiResponse
    }, async (req, res) => {
        const { connection } = await Auth.is_connection(config, req, {
            resources: [
                // Connection tokens shouldn't use this, only internal Data/Lambda Tokens
                { access: AuthResourceAccess.DATA, id: req.params.dataid }
            ]
        }, req.params.connectionid);

        try {
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const content = await api.Files.upload({
                name: String(req.query.name),
                contentLength: Number(req.headers['content-length']),
                keywords: [],
                creatorUid: `CloudTAK-Conn-${req.params.connectionid}`,
            }, req);

            // @ts-expect-error Morgan will throw an error after not getting req.ip and there not being req.connection.remoteAddress
            req.connection = {
                // @ts-expect-error Not in spec
                remoteAddress: req._remoteAddress || '127.0.0.1'
            }

            try {
                await DataMission.sync(config, data);
            } catch (err) {
                console.error(err)
            }

            const missionContent = await api.Mission.attachContents(data.name, {
                hashes: [content.Hash]
            }, {
                token: data.mission_token
            });

            return res.json(missionContent);
        } catch (err) {
            console.error(err);
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/data/:dataid/asset', {
        name: 'Create Asset',
        group: 'DataAssets',
        description: 'Create a new asset',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {

        let bb;
        let data: InferSelectModel<typeof Data>;
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            if (!req.headers['content-type']) throw new Err(400, null, 'Missing Content-Type Header');

            bb = busboy({
                headers: req.headers,
                limits: {
                    files: 1
                }
            });
        } catch (err) {
            return Err.respond(err, res);
        }

        const assets: Promise<void>[] = [];
        bb.on('file', async (fieldname, file, blob) => {
            try {
                const passThrough = new Stream.PassThrough();
                file.pipe(passThrough);

                assets.push(S3.put(`data/${data.id}/${blob.filename}`, passThrough));
            } catch (err) {
                return Err.respond(err, res);
            }
        }).on('finish', async () => {
            try {
                if (!assets.length) throw new Err(400, null, 'No Asset Provided');

                await assets[0];

                return res.json({
                    status: 200,
                    message: 'Asset Uploaded'
                });
            } catch (err) {
                Err.respond(err, res);
            }
        });

        return req.pipe(bb);
    });

    await schema.post('/connection/:connectionid/data/:dataid/asset/:asset.:ext', {
        name: 'Convert Asset',
        group: 'DataAssets',
        description: 'Convert Asset into a cloud native or TAK Native format automatically',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer(),
            asset: Type.String(),
            ext: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            await Batch.submitData(config, data, `${req.params.asset}.${req.params.ext}`);

            return res.json({
                status: 200,
                message: 'Conversion Initiated'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/data/:dataid/asset/:asset.:ext', {
        name: 'Delete Asset',
        group: 'DataAssets',
        description: 'Delete Asset',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer(),
            asset: Type.String(),
            ext: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));
            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const file = `${req.params.asset}.${req.params.ext}`;
            try {
                if (data.mission_sync) {
                    const mission = await api.Mission.get(data.name, {}, {
                        token: data.mission_token
                    });

                    for (const content of mission.contents) {
                        if (content.data.name === file) {
                            await api.Mission.detachContents(data.name, {
                                hash: content.data.hash
                            }, {
                                token: data.mission_token
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            }

            const list = await assetList(config, `data/${String(req.params.dataid)}/`);
            for (const asset of list.assets) {
                if (asset.name !== file) continue;

                if (asset.visualized) await S3.del(`data/${req.params.dataid}/${req.params.asset}.pmtiles`);
                if (asset.vectorized) await S3.del(`data/${req.params.dataid}/${req.params.asset}.geojsonld`);
                await S3.del(`data/${req.params.dataid}/${file}`);
            }

            return res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/asset/:asset.:ext', {
        name: 'Raw Asset',
        group: 'DataAssets',
        description: 'Get single raw asset',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer(),
            asset: Type.String(),
            ext: Type.String()
        }),
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                token: true,
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            const stream = await S3.get(`data/${req.params.dataid}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/data/:dataid/asset/:asset.pmtiles/tile', {
        name: 'PMTiles TileJSON',
        group: 'DataAssets',
        description: 'Get TileJSON ',
        params: Type.Object({
            connectionid: Type.Integer(),
            dataid: Type.Integer(),
            asset: Type.String(),
        }),
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                token: true,
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid },
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }
                ]
            }, req.params.connectionid);

            const data = await config.models.Data.from(req.params.dataid);
            if (data.connection !== connection.id) throw new Err(400, null, 'Data Sync does not belong to given Connection');

            if (!await S3.exists(`data/${req.params.dataid}/${req.params.asset}.pmtiles`)) {
                throw new Err(404, null, 'Asset does not exist');
            }

            const token = jwt.sign({ access: 'user' }, config.SigningSecret)
            const url = new URL(`${config.PMTILES_URL}/tiles/data/${data.id}/${req.params.asset}`);
            url.searchParams.append('token', token);

            return res.redirect(String(url));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
