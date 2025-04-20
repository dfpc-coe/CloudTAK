import AWSS3 from '@aws-sdk/client-s3';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { TileJSON } from '../lib/tile.js'
import auth from '../lib/auth.js';

export default async function router(schema: Schema) {
    schema.get('/tiles/public', {
        name: 'Get Sources',
        group: 'PublicTiles',
        description: 'Return a list of public tile sources',
        query: Type.Object({
            token: Type.String()
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                name: Type.String(),
                hash: Type.String(),
                updated: Type.String(),
                size: Type.Integer(),
            }))
        })
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const client = new AWSS3.S3Client();

            const Contents = [];

            let s3res;
            do {
                const req: AWSS3.ListObjectsV2CommandInput = {
                    Bucket: process.env.ASSET_BUCKET,
                    Prefix: 'public/'
                };

                if (s3res && s3res.NextContinuationToken) {
                    req.ContinuationToken = s3res.NextContinuationToken;
                }

                s3res = await client.send(new AWSS3.ListObjectsV2Command(req))

                Contents.push(...((s3res.Contents || []).filter((Content) => {
                    return (Content.Key || '').endsWith('.pmtiles')
                }) || []));
            } while (s3res.NextContinuationToken)

            res.json({
                total: Contents.length,
                items: Contents
                    .filter((Content) => {
                        return Content.ETag && Content.Key
                    })
                    .map((Content) => {
                        return {
                            name: (Content.Key || ''),
                            hash: JSON.parse(Content.ETag || '""'),
                            updated: Content.LastModified ? Content.LastModified.toISOString() : new Date().toISOString(),
                            size: Content.Size || 0
                        }
                    })
            })
        } catch (err) {
            Err.respond(err, res);
        }
    });

    schema.get('/tiles/public/:name', {
        name: 'Get TileJSON',
        group: 'ProfileTiles',
        description: 'Return TileJSON for a given file',
        params: Type.Object({
            name: Type.String()
        }),
        query: Type.Object({
            token: Type.String()
        }),
        res: TileJSON
    }, async (req, res) => {
        try {
            const token = auth(req.query.token);
            if (token.email !== req.params.username || token.access !== 'profile') {
                throw new Err(401, null, 'Unauthorized Access');
            }

            const path = `public/${req.params.name}`;
            const p = new pmtiles.PMTiles(new S3Source(path), CACHE, nativeDecompress);
            const header = await p.getHeader();

            let format = 'mvt';
            for (const pair of [
                [pmtiles.TileType.Mvt, "mvt"],
                [pmtiles.TileType.Png, "png"],
                [pmtiles.TileType.Jpeg, "jpg"],
                [pmtiles.TileType.Webp, "webp"],
                [pmtiles.TileType.Avif, "avif"],
            ]) {
                if (header.tileType === pair[0]) {
                    format = String(pair[1]);
                }
            }

            res.json({
                "tilejson": "2.2.0",
                "name": `${req.params.name}.pmtiles`,
                "description": "Hosted by CloudTAK",
                "version": "1.0.0",
                "scheme": "xyz",
                "tiles": [ process.env.APIROOT + `/tiles/${path}/tiles/{z}/{x}/{y}.${format}?token=${req.query.token}`],
                "minzoom": header.minZoom,
                "maxzoom": header.maxZoom,
                "bounds": [ header.minLon, header.minLat, header.maxLon, header.maxLat ],
                "meta": header,
                "center": [ header.centerLon, header.centerLat, header.centerZoom ]
            });
        } catch (err) {
            Err.respond(err, res);
        }
    })
}
