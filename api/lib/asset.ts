import Err from '@openaddresses/batch-error';
import path from 'path';
import S3 from '../lib/aws/s3.js';
import { _Object } from '@aws-sdk/client-s3';

import Config from '../lib/config.js';

export type AssetListOutput = {
    total: number;
    tiles: {
        url: string;
    },
    assets: Array<AssetOutput>
}

export type AssetOutput = {
    name: string;
    visualized?: string;
    vectorized?: string,
    updated: number;
    etag: string;
    size: number;
}

export default async function AssetList(config: Config, prefix: string): Promise<AssetListOutput> {
    try {
        const viz = new Map() ;
        const geo = new Map() ;
        const assets: Array<_Object> = [];
        (await S3.list(prefix))
            .map((l) => {
                if (path.parse(String(l.Key)).ext === '.pmtiles') viz.set(path.parse(String(l.Key)).name, l)
                else if (path.parse(String(l.Key)).ext === '.geojsonld') geo.set(path.parse(String(l.Key)).name, l)
                else assets.push(l)
            });

        const final: AssetOutput[]  = assets.map((a: _Object) => {
            const isViz = viz.get(path.parse(String(a.Key)).name);
            if (isViz) viz.delete(path.parse(String(a.Key)).name);
            const isGeo = geo.get(path.parse(String(a.Key)).name);
            if (isGeo) geo.delete(path.parse(String(a.Key)).name);

            return {
                name: String(a.Key).replace(prefix, ''),
                visualized: isViz ? path.parse(String(a.Key).replace(prefix, '')).name + '.pmtiles' : undefined,
                vectorized: isGeo ? path.parse(String(a.Key).replace(prefix, '')).name + '.geojsonld' : undefined,
                updated: a.LastModified ? new Date(a.LastModified).getTime() : new Date().getTime(),
                etag: String(JSON.parse(String(a.ETag))),
                size: a.Size ? a.Size : 0
            };
        }).concat(Array.from(geo.values()).map((a) => {
            const isViz = viz.get(path.parse(String(a.Key)).name);
            if (isViz) viz.delete(path.parse(String(a.Key)).name);

            return {
                name: String(a.Key).replace(prefix, ''),
                visualized: isViz ? path.parse(String(a.Key).replace(prefix, '')).name + '.pmtiles' : undefined,
                vectorized: String(a.Key).replace(prefix, ''),
                updated: a.LastModified ? new Date(a.LastModified).getTime() : new Date().getTime(),
                etag: String(JSON.parse(String(a.ETag))),
                size: a.Size ? a.Size : 0
            };

        })).concat(Array.from(viz.values()).map((a) => {
            return {
                name: String(a.Key).replace(prefix, ''),
                visualized: String(a.Key).replace(prefix, ''),
                vectorized: undefined,
                updated: a.LastModified ? new Date(a.LastModified).getTime() : new Date().getTime(),
                etag: String(JSON.parse(String(a.ETag))),
                size: a.Size ? a.Size : 0
            };
        }));

        return {
            total: final.length,
            tiles: {
                url: String(new URL(`${config.PMTILES_URL}/tiles/${prefix}`))
            },
            assets: final
        };
    } catch (err) {
        throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Asset List Error');
    }
}
