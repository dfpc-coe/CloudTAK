import { Type } from '@sinclair/typebox'
import { StandardResponse, ProfileAssetResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
import fs from 'node:fs/promises';
import path from 'path';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Stream from 'node:stream';
import Batch from '../lib/aws/batch.js';
import jwt from 'jsonwebtoken';
import { includesWithGlob } from "array-includes-with-glob";
import assetList from '../lib/asset.js';
import { Response } from 'express';
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
            return res.json(await assetList(config, `profile/${user.email}/`));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/profile/asset', {
        name: 'Create Asset',
        group: 'UserAssets',
        description: 'Create a new asset',
        res: StandardResponse
    }, async (req, res) => {

        let bb;
        try {
            const user = await Auth.as_user(config, req);

            if (!req.headers['content-type']) throw new Err(400, null, 'Missing Content-Type Header');

            bb = busboy({
                headers: req.headers,
                limits: {
                    files: 1
                }
            });

            const assets: Promise<void>[] = [];
            bb.on('file', async (fieldname, file, blob) => {
                try {
                    const passThrough = new Stream.PassThrough();
                    file.pipe(passThrough);

                    assets.push((async () => {
                        await S3.put(`profile/${user.email}/${blob.filename}`, passThrough);
                        await Batch.submitUser(config, user.email, `${blob.filename}`);
                    })());
                } catch (err) {
                    return Err.respond(err, res);
                }
            }).on('finish', async () => {
                try {
                    if (!assets.length) throw new Err(400, null, 'No Asset Provided');
                    await Promise.all(assets);

                    return res.json({
                        status: 200,
                        message: 'Asset Uploaded'
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

    await schema.post('/profile/asset/:asset.:ext', {
        name: 'Convert Asset',
        group: 'UserAssets',
        description: 'Convert Asset into a cloud native or TAK Native format automatically',
        params: Type.Object({
            asset: Type.String(),
            ext: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            await Batch.submitUser(config, user.email, `${req.params.asset}.${req.params.ext}`);

            return res.json({
                status: 200,
                message: 'Conversion Initiated'
            });
        } catch (err) {
            return Err.respond(err, res);
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

            return res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
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
            return Err.respond(err, res);
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

            if (!await S3.exists(`profile/${user.email}/${req.params.asset}.${req.params.ext}`)) {
                throw new Error(404, null, 'Asset does not exist');
            }

            const token = jwt.sign({ access: 'profile', email: user.email }, config.SigningSecret)
            const url = new URL(`${config.PMTILES_URL}/tiles/profile/${user.email}/${req.params.asset}`);
            url.searchParams.append('token', token);

            return res.redirect(String(url));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
