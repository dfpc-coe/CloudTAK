import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
import fs from 'node:fs/promises';
import path from 'path';
import Profile from '../lib/types/profile.js';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Stream from 'node:stream';
import Batch from '../lib/aws/batch.js';
import jwt from 'jsonwebtoken';
import { includesWithGlob } from "array-includes-with-glob";

import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/profile/asset', {
        name: 'List Assets',
        auth: 'user',
        group: 'UserAssets',
        description: 'List Assets',
        res: 'res.ListAssets.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const viz = new Map() ;
            let assets = [];
            (await S3.list(`user/${req.auth.email}/`)).map((l) => {
                if (path.parse(l.Key).ext === '.pmtiles') viz.set(path.parse(l.Key).name, l)
                else assets.push(l)
            });

            assets = assets.map((a) => {
                const isViz = viz.get(path.parse(a.Key).name);
                if (isViz) viz.delete(path.parse(a.Key).name);

                return {
                    name: a.Key.replace(`user/${req.auth.email}/`, ''),
                    visualized: path.parse(a.Key.replace(`user/${req.auth.email}/`, '')).name + '.pmtiles',
                    updated: new Date(a.LastModified).getTime(),
                    etag: JSON.parse(a.ETag),
                    size: a.Size
                };
            }).concat(Array.from(viz.values()).map((a) => {
                return {
                    name: a.Key.replace(`user/${req.auth.email}/`, ''),
                    visualized: a.Key.replace(`user/${req.auth.email}/`, ''),
                    updated: new Date(a.LastModified).getTime(),
                    etag: JSON.parse(a.ETag),
                    size: a.Size
                };
            }))

            return res.json({
                total: assets.length,
                tiles: {
                    url: String(new URL(`${config.PMTILES_URL}/tiles/user/${req.auth.email}/`))
                },
                assets
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/user/asset', {
        name: 'Create Asset',
        auth: 'user',
        group: 'UserAssets',
        description: 'Create a new asset',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {

        let bb;
        try {
            await Auth.is_auth(req);

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

                assets.push(S3.put(`user/${req.auth.email}/${blob.filename}`, passThrough));
            } catch (err) {
                return Err.respond(err, res);
            }
        }).on('finish', async () => {
            try {
                if (!assets.length) throw new Err(400, null, 'No Asset Provided');

                await assets[0];

                //TODO Make this generic to support user inputs
                await Batch.submit(config, data, `${req.params.asset}.${req.params.ext}`, req.body);

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

    await schema.post('/user/asset/:asset.:ext', {
        name: 'Convert Asset',
        auth: 'user',
        group: 'UserAssets',
        description: 'Convert Asset into a cloud native or TAK Native format automatically',
        ':asset': 'string',
        ':ext': 'string',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            //TODO Make this generic to support user inputs
            await Batch.submit(config, data, `${req.params.asset}.${req.params.ext}`, req.body);

            return res.json({
                status: 200,
                message: 'Conversion Initiated'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/user/asset/:asset.:ext', {
        name: 'Delete Asset',
        auth: 'user',
        group: 'UserAssets',
        description: 'Delete Asset',
        ':asset': 'string',
        ':ext': 'string',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            await S3.del(`user/${req.auth.email}/${req.params.asset}.${req.params.ext}`);

            return res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/user/asset/:asset.:ext', {
        name: 'Raw Asset',
        auth: 'user',
        group: 'UserAssets',
        description: 'Get single raw asset',
        ':asset': 'string',
        ':ext': 'string'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            const stream = await S3.get(`user/${req.auth.email}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/user/asset/:asset.pmtiles/tile', {
        name: 'PMTiles TileJSON',
        auth: 'user',
        group: 'UserAssets',
        description: 'Get TileJSON ',
        ':asset': 'string'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            const token = jwt.sign({ access: 'user' }, config.SigningSecret)
            const url = new URL(`${config.PMTILES_URL}/tiles/user/${req.auth.email}/${req.params.asset}`);
            url.searchParams.append('token', token);

            return res.redirect(String(url));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
