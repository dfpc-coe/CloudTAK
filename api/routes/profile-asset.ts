import { Type } from '@sinclair/typebox'
import { StandardResponse, ProfileAssetResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import jwt from 'jsonwebtoken';
import assetList from '../lib/asset.js';
import Config from '../lib/config.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/asset', {
        name: 'List Assets',
        group: 'UserAssets',
        description: 'List Assets',
        res: Type.Object({
            total: Type.Integer(),
            tiles: Type.Object({
                url: Type.String()
            }),
            assets: Type.Array(ProfileAssetResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            res.json(await assetList(config, `profile/${user.email}/`));
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/asset/:asset.:ext', {
        name: 'Delete Asset',
        group: 'UserAssets',
        description: 'Delete Asset',
        params: Type.Object({
            asset: Type.String(),
            ext: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await S3.del(`profile/${user.email}/${req.params.asset}.${req.params.ext}`);

            if (await S3.exists(`profile/${user.email}/${req.params.asset}.geojsonld`)) {
                await S3.del(`profile/${user.email}/${req.params.asset}.geojsonld`);
            }

            if (await S3.exists(`profile/${user.email}/${req.params.asset}.pmtiles`)) {
                await S3.del(`profile/${user.email}/${req.params.asset}.pmtiles`);
            }

            res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/asset/:asset.:ext', {
        name: 'Raw Asset',
        group: 'UserAssets',
        description: 'Get single raw asset',
        query: Type.Object({
            token: Type.Optional(Type.String())
        }),
        params: Type.Object({
            asset: Type.String(),
            ext: Type.String()
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const stream = await S3.get(`profile/${user.email}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/asset/:asset.pmtiles/tile', {
        name: 'PMTiles TileJSON',
        group: 'UserAssets',
        description: 'Get TileJSON ',
        query: Type.Object({
            token: Type.Optional(Type.String())
        }),
        params: Type.Object({
            asset: Type.String(),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            if (!await S3.exists(`profile/${user.email}/${req.params.asset}.pmtiles`)) {
                throw new Err(404, null, 'Asset does not exist');
            }

            const token = jwt.sign({ access: 'profile', email: user.email }, config.SigningSecret)
            const url = new URL(`${config.PMTILES_URL}/tiles/profile/${user.email}/${req.params.asset}`);
            url.searchParams.append('token', token);

            res.redirect(String(url));
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
