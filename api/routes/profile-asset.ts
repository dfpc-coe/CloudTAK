import { Type } from '@sinclair/typebox'
import { StandardResponse, ProfileFileResponse } from '../lib/types.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import jwt from 'jsonwebtoken';
import { ProfileFile } from '../lib/schema.js';
import Config from '../lib/config.js';
import * as Default from '../lib/limits.js'

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/asset', {
        name: 'List Files',
        group: 'ProfileFile',
        description: 'List Files',
        query: Type.Object({
            limit: Type.Integer({
                default: 100,
                minimum: 1,
                maximum: 1000
            }),
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfileFile)
            }),
            filter: Type.String({
                default: ''
            }),
            page: Default.Page,
            order: Default.Order,
        }),
        res: Type.Object({
            total: Type.Integer(),
            tiles: Type.Object({
                url: Type.String()
            }),
            items: Type.Array(ProfileFileResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const list = await config.models.ProfileFile.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND username = ${user.email}
                `
            });


            res.json({
                tiles: {
                    url: String(new URL(`${config.PMTILES_URL}/tiles/profile/${user.email}/`))
                },
                ...list
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/asset/:asset', {
        name: 'Delete File',
        group: 'ProfileFile',
        description: 'Delete Asset',
        params: Type.Object({
            asset: Type.String(),
            ext: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to delete this asset');
            }

            await config.models.ProfileFile.delete(req.params.asset);

            await S3.del(`profile/${user.email}/${req.params.asset}`, {
                recurse: true
            });

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
        group: 'ProfileFile',
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

            const file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to delete this asset');
            }

            const stream = await S3.get(`profile/${user.email}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/asset/:asset.pmtiles/tile', {
        name: 'PMTiles TileJSON',
        group: 'ProfileFile',
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

            const file = await config.models.ProfileFile.from(req.params.asset);

            if (file.username !== user.email) {
                throw new Err(403, null, 'You do not have permission to delete this asset');
            }

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
