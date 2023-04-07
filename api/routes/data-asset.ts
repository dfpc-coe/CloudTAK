import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
import fs from 'node:fs/promises';
import path from 'path';
// @ts-ignore
import Data from '../lib/types/data.js';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Stream from 'node:stream';
import Batch from '../lib/aws/batch.js';

import { Request, Response } from 'express';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/data/:dataid/asset', {
        name: 'List Assets',
        auth: 'user',
        group: 'DataAssets',
        description: 'List Assets',
        ':dataid': 'integer',
        res: 'res.ListAssets.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const list: any[] = await S3.list(`data/${data.id}/`);

            return res.json({
                total: list.length,
                assets: list.map((asset) => {
                    return {
                        name: asset.Key.replace(`data/${data.id}/`, ''),
                        updated: new Date(asset.LastModified).getTime(),
                        etag: JSON.parse(asset.ETag),
                        size: asset.Size
                    };
                })
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/data/:dataid/asset', {
        name: 'Create Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Create a new asset',
        ':dataid': 'integer',
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {

        let bb;
        let data: any;
        try {
            await Auth.is_auth(req);

            data = await Data.from(config.pool, req.params.dataid);

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

    await schema.post('/data/:dataid/asset/:asset.:ext', {
        name: 'Convert Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Convert Asset',
        ':dataid': 'integer',
        ':asset': 'string',
        ':ext': 'string',
        body: 'req.ConvertAsset.json',
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            await Batch.submit(config, data, `${req.params.asset}.${req.params.ext}`, req.body);

            return res.json({
                status: 200,
                message: 'Conversion Initiated'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/data/:dataid/asset/:asset.:ext', {
        name: 'Delete Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Delete Asset',
        ':dataid': 'integer',
        ':asset': 'string',
        ':ext': 'string',
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            await S3.del(`data/${req.params.dataid}/${req.params.asset}.${req.params.ext}`);

            return res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid/asset/:asset.:ext', {
        name: 'Raw Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Get single raw asset',
        ':dataid': 'integer',
        ':asset': 'string',
        ':ext': 'string'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            const stream = await S3.get(`data/${req.params.dataid}/${req.params.asset}.${req.params.ext}`);

            stream.pipe(res);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid/asset/:asset.pmtiles/tile', {
        name: 'PMTiles TileJSON',
        auth: 'user',
        group: 'DataAssets',
        description: 'Get TileJSON ',
        ':dataid': 'integer',
        ':asset': 'string'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req, true);

            const data = await Data.from(config.pool, req.params.dataid);

            return res.redirect(String(new URL(`${config.PMTILES_URL}/data/${data.id}/${req.params.asset}`)));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
