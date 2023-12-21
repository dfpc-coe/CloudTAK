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

import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';

export default async function AssetList(config: Config, prefix: string) {
    try {
        const viz = new Map() ;
        const geo = new Map() ;
        let assets = [];
        (await S3.list(prefix)).map((l) => {
            if (path.parse(l.Key).ext === '.pmtiles') viz.set(path.parse(l.Key).name, l)
            else if (path.parse(l.Key).ext === '.geojsonld') geo.set(path.parse(l.Key).name, l)
            else assets.push(l)
        });

        assets = assets.map((a) => {
            const isViz = viz.get(path.parse(a.Key).name);
            if (isViz) viz.delete(path.parse(a.Key).name);
            const isGeo = geo.get(path.parse(a.Key).name);
            if (isGeo) geo.delete(path.parse(a.Key).name);

            return {
                name: a.Key.replace(prefix, ''),
                visualized: isViz ? path.parse(a.Key.replace(prefix, '')).name + '.pmtiles' : false,
                vectorized: isGeo ? path.parse(a.Key.replace(prefix, '')).name + '.geojsonld' : false,
                updated: new Date(a.LastModified).getTime(),
                etag: JSON.parse(a.ETag),
                size: a.Size
            };
        }).concat(Array.from(geo.values()).map((a) => {
            const isViz = viz.get(path.parse(a.Key).name);
            if (isViz) viz.delete(path.parse(a.Key).name);

            return {
                name: a.Key.replace(prefix, ''),
                visualized: isViz ? path.parse(a.Key.replace(prefix, '')).name + '.pmtiles' : false,
                vectorized: a.Key.replace(prefix, ''),
                updated: new Date(a.LastModified).getTime(),
                etag: JSON.parse(a.ETag),
                size: a.Size
            };

        })).concat(Array.from(viz.values()).map((a) => {
            return {
                name: a.Key.replace(prefix, ''),
                visualized: a.Key.replace(prefix, ''),
                vectorized: false,
                updated: new Date(a.LastModified).getTime(),
                etag: JSON.parse(a.ETag),
                size: a.Size
            };
        }));

        return {
            total: assets.length,
            tiles: {
                url: String(new URL(`${config.PMTILES_URL}/tiles/${prefix}`))
            },
            assets
        };
    } catch (err) {
        throw new Err(500, err, 'Asset List Error');
    }
}
