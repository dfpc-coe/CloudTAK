import AWSS3 from '@aws-sdk/client-s3';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { FileTiles, TileJSON, QueryResponse, FeaturesResponse } from '../lib/tiles.js'
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
        group: 'PublicTiles',
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
            auth(req.query.token);

            const file = new FileTiles(`public/${req.params.name}`);
            res.json(await file.tilejson(req.query.token));
        } catch (err) {
            Err.respond(err, res);
        }
    })

    schema.get('/tiles/public/:name/query', {
        name: 'Query',
        group: 'PublicTiles',
        description: 'Return features for a given query',
        params: Type.Object({
            name: Type.String()
        }),
        query: Type.Object({
            token: Type.String(),
            query: Type.String(),
            zoom: Type.Optional(Type.Integer()),
            limit: Type.Integer({ default: 1 })
        }),
        res: QueryResponse
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const file = new FileTiles(`public/${req.params.name}`);
            res.json(await file.query(req.query.query, {
                limit: req.query.limit,
                zoom: req.query.zoom
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    })

    schema.get('/tiles/public/:name/:z/:x/:y/features', {
        name: 'Get Features',
        group: 'PublicTiles',
        description: 'Return features for a given zxy',
        query: Type.Object({
            token: Type.String(),
            layer: Type.Optional(Type.String())
        }),
        params: Type.Object({
            name: Type.String(),
            z: Type.Integer(),
            x: Type.Integer(),
            y: Type.Integer()
        }),
        res: FeaturesResponse
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const file = new FileTiles(`public/${req.params.name}`);

            res.json(await file.features(req.params.z, req.params.x, req.params.y, {
                layer: req.query.layer
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    })

    schema.get('/tiles/public/:name/features', {
        name: 'Get Features',
        group: 'PublicTiles',
        description: 'Return features for a given bbox',
        query: Type.Object({
            token: Type.String(),
            layer: Type.Optional(Type.String()),
            zoom: Type.Optional(Type.Integer()),
            bbox: Type.String({ description: 'BBOX in format "minX,minY,maxX,maxY"' })
        }),
        params: Type.Object({
            name: Type.String()
        }),
        res: FeaturesResponse
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const file = new FileTiles(`public/${req.params.name}`);

            const bbox = req.query.bbox.split(',').map((b) => Number(b));
            if (bbox.length !== 4 || bbox.some((b) => isNaN(b))) throw new Err(400, null, 'Invalid BBOX');

            res.json(await file.featuresByBounds(bbox, {
                layer: req.query.layer,
                zoom: req.query.zoom
            }));
        } catch (err) {
            Err.respond(err, res);
        }
    })

    schema.get('/tiles/public/:name/tiles/:z/:x/:y.:ext', {
        name: 'Get Tile',
        group: 'PublicTiles',
        description: 'Return tile for a given zxy',
        query: Type.Object({
            token: Type.String()
        }),
        params: Type.Object({
            name: Type.String(),
            z: Type.Integer(),
            x: Type.Integer(),
            y: Type.Integer(),
            ext: Type.String()
        }),
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const file = new FileTiles(`public/${req.params.name}`);

            await file.tile(res, req.params.z, req.params.x, req.params.y, req.params.ext);
        } catch (err) {
            Err.respond(err, res);
        }
    })
}
