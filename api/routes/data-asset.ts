import Err from '@openaddresses/batch-error';
import busboy from 'busboy';
import fs from 'node:fs/promises';
import path from 'path';
// @ts-ignore
import Asset from '../lib/types/asset.js';
// @ts-ignore
import Data from '../lib/types/data.js';
import Auth from '../lib/auth.js';
import S3 from '../lib/aws/s3.js';
import Stream from 'node:stream';

import { Request, Response } from 'express';
import Config from '../lib/config.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/data/:dataid/asset', {
        name: 'List Assets',
        auth: 'user',
        group: 'DataAssets',
        description: 'List Assets',
        ':dataid': 'integer',
        query: 'req.query.ListAssets.json',
        res: 'res.ListAssets.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const data = await Data.from(config.pool, req.params.dataid);

            const list: any[] = await S3.list(`data/${data.id}/`);

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/asset/:assetid', {
        name: 'Get Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Get single asset',
        ':assetid': 'integer',
        res: 'assets.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);
            const asset = await Asset.from(config.pool, req.params.assetid);
            return res.json(asset.serialize());
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

    await schema.delete('/asset/:assetid', {
        name: 'Delete Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Delete Asset',
        ':assetid': 'integer',
        res: 'res.Standard.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);
            const asset = await Asset.from(config.pool, req.params.assetid);
            await asset.delete();

            await fs.unlink(new URL(`../assets/${asset.id}${path.parse(asset.name).ext}`, import.meta.url));

            return res.json({
                status: 200,
                message: 'Asset Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/asset/:assetid/raw', {
        name: 'Raw Asset',
        auth: 'user',
        group: 'DataAssets',
        description: 'Get single raw asset',
        ':assetid': 'integer'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            // this should be optimized to read directly... maybe store the extension in the DB?
            // could also allow user restricted files in the future..
            let afile = null;
            for (const file of await fs.readdir(new URL('../assets/', import.meta.url))) {
                if (path.parse(file).name === String(req.params.assetid)) {
                    afile = file;
                    break;
                }
            }

            res.contentType(afile);
            res.send(await fs.readFile(new URL('../assets/' + afile, import.meta.url)));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
