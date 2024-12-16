import express from 'express';
import { createHash } from "crypto";
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import cors from 'cors';
import { S3Source, nativeDecompress, CACHE } from './lib/pmtiles.js';
import auth from './lib/auth.js';
import * as pmtiles from 'pmtiles';
import zlib from "zlib";
// @ts-expect-error No Type Defs
import vtquery from '@mapbox/vtquery';
import { pointToTile } from '@mapbox/tilebelt';
import serverless from 'serverless-http';

if (!process.env.SigningSecret) throw new Error('SigningSecret env var must be provided');
if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env var must be provided');
if (!process.env.APIROOT) process.env.APIROOT = 'http://localhost:5002';

const app = express();

const schema = new Schema(express.Router(), {
    logging: true,
    limit: 50
});

app.disable('x-powered-by');

app.use(cors({
    origin: '*',
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'User-Agent',
        'MissionAuthorization',
        'Content-Length',
        'x-requested-with'
    ],
    credentials: true
}));

app.use(schema.router);

schema.get('/tiles/profile/:username/:file', {
    name: 'Get TileJSON',
    group: 'ProfileTiles',
    description: 'Return TileJSON for a given file',
    params: Type.Object({
        username: Type.String(),
        file: Type.String()
    }),
    query: Type.Object({
        token: Type.String()
    }),
    res: Type.Object({
        tilejson: Type.Literal('2.2.0'),
        name: Type.String(),
        description: Type.String(),
        version: Type.Literal('1.0.0'),
        scheme: Type.Literal('xyz'),
        tiles: Type.Array(Type.String()),
        minzoom: Type.Integer(),
        maxzoom: Type.Integer(),
        bounds: Type.Array(Type.Number()),
        meta: Type.Unknown(),
        center: Type.Array(Type.Number())
    })
}, async (req, res) => {
    try {
        const token = auth(req.query.token);
        if (token.email !== req.params.username || token.access !== 'profile') {
            throw new Err(401, null, 'Unauthorized Access');
        }

        const path = `profile/${req.params.username}/${req.params.file}`;
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
            "name": `${req.params.file}.pmtiles`,
            "description": "Hosted by TAK-ETL",
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

schema.get('/tiles/profile/:username/:file/query', {
    name: 'Get TileJSON',
    group: 'ProfileTiles',
    description: 'Return TileJSON for a given file',
    params: Type.Object({
        username: Type.String(),
        file: Type.String()
    }),
    query: Type.Object({
        token: Type.String(),
        query: Type.String(),
        zoom: Type.Optional(Type.Integer()),
        limit: Type.Integer({ default: 1 })
    }),
    res: Type.Object({
        type: Type.Literal('FeatureCollection'),
        query: Type.Object({
            lnglat: Type.Array(Type.Number()),
            zoom: Type.Number(),
            limit: Type.Number()
        }),
        meta: Type.Object({
            z: Type.Number({
                description: 'The Zoom level the query falls in'
            }),
            x: Type.Number({
                description: 'The X ZXY coordinate the query falls in'
            }),
            y: Type.Number({
                description: 'The Y ZXY coordinate the query falls in'
            })
        }),
        features: Type.Array(Type.Object({
            type: Type.Literal('Feature'),
            properties: Type.Record(Type.String(), Type.String()),
            geometry: Type.Object({
                type: Type.String(),
                coordinates: Type.Array(Type.Unknown())
            })
        }))
    })
}, async (req, res) => {
    try {
        const token = auth(req.query.token);
        if (token.email !== req.params.username || token.access !== 'profile') {
            throw new Err(401, null, 'Unauthorized Access');
        }

        const path = `profile/${req.params.username}/${req.params.file}`;
        const p = new pmtiles.PMTiles(new S3Source(path), CACHE, nativeDecompress);
        const header = await p.getHeader();

        const query: {
            lnglat: number[],
            zoom: number,
            limit: number
        } = {
            lnglat: [],
            zoom: req.query.zoom || header.maxZoom,
            limit: req.query.limit
        }

        const lnglat: number[] = req.query.query
            .split(',')
            .map((comp) => { return Number(comp) });

        if (lnglat.length !== 2) throw new Err(400, null, "Invalid LngLat");
        if (isNaN(lnglat[0]) || isNaN(lnglat[1])) throw new Err(400, null, "Invalid LngLat (Non-Numeric)");
        query.lnglat = lnglat;
        if (isNaN(query.zoom)) throw new Err(400, null, "Invalid Integer Zoom");
        if (isNaN(query.limit)) throw new Err(400, null, "Invalid Integer Limit");
        if (query.zoom > header.maxZoom) throw new Err(400, null, "Above Layer MaxZoom");
        if (query.zoom < header.minZoom) throw new Err(400, null, "Below Layer MinZoom");

        const xyz = pointToTile(query.lnglat[0], query.lnglat[1], query.zoom)
        const tile = await p.getZxy(xyz[2], xyz[0], xyz[1]);

        const meta = { x: xyz[0], y: xyz[1], z: xyz[2] };

        if (!tile) {
            res.json({
                type: 'FeatureCollection',
                query,
                meta,
                features: []
            });
        } else {
            const fc: any = await new Promise((resolve, reject) => {
                vtquery([
                    { buffer: tile.data, z: xyz[2], x: xyz[0], y: xyz[1] }
                ], query.lnglat, {
                    limit: query.limit
                }, (err: Error, fc: {
                    type: string,
                    features: object[]
                }) => {
                    if (err) return reject(err);
                    return resolve(fc);
                });
            });

            fc.query = query;
            fc.meta = meta;

            res.json(fc);
        }
    } catch (err) {
        Err.respond(err, res);
    }
})

schema.get('/tiles/profile/:username/:file/tiles/:z/:x/:y.:ext', {
    name: 'Get Tile',
    group: 'ProfileTiles',
    description: 'Return tile for a given zxy',
    query: Type.Object({
        token: Type.String()
    }),
    params: Type.Object({
        username: Type.String(),
        file: Type.String(),
        z: Type.Integer(),
        x: Type.Integer(),
        y: Type.Integer(),
        ext: Type.String()
    }),
}, async (req, res) => {
    try {
        const token = auth(req.query.token);
        if (token.email !== req.params.username || token.access !== 'profile') {
            throw new Err(401, null, 'Unauthorized Access');
        }

        const path = `profile/${req.params.username}/${req.params.file}`;
        const p = new pmtiles.PMTiles(new S3Source(path), CACHE, nativeDecompress);
        const header = await p.getHeader();

        if (req.params.z < header.minZoom || req.params.z > header.maxZoom) {
            throw new Err(404, null, 'File Not Found');
        }

        for (const pair of [
            [pmtiles.TileType.Mvt, "mvt"],
            [pmtiles.TileType.Png, "png"],
            [pmtiles.TileType.Jpeg, "jpg"],
            [pmtiles.TileType.Webp, "webp"],
            [pmtiles.TileType.Avif, "avif"],
        ]) {
            if (header.tileType === pair[0] && req.params.ext !== pair[1]) {
                if (header.tileType == pmtiles.TileType.Mvt && req.params.ext === "pbf") {
                    // allow this for now. Eventually we will delete this in favor of .mvt
                    continue;
                }

                throw new Err(400, null, "Bad request: archive has type ." + pair[1]);
            }
        }

        const tile_result = await p.getZxy(req.params.z, req.params.x, req.params.y);

        if (tile_result) {
            switch (header.tileType) {
                case pmtiles.TileType.Mvt:
                    // part of the list of Cloudfront compressible types.
                    res.set("Content-Type", "application/vnd.mapbox-vector-tile");
                break;
                case pmtiles.TileType.Png:
                    res.set("Content-Type", "image/png");
                break;
                case pmtiles.TileType.Jpeg:
                    res.set("Content-Type", "image/jpeg");
                break;
                case pmtiles.TileType.Webp:
                    res.set("Content-Type", "image/webp");
                break;
            }

            const data = tile_result.data;

            res.set("Cache-Control", "private, max-age=86400");
            res.set('ETag', `"${createHash("sha256").update(Buffer.from(data)).digest("hex")}"`);

            // We need to force API Gateway to interpret the Lambda response as binary
            // without depending on clients sending matching Accept: headers in the request.
            if (process.env.StackName) {
                res.set("Content-Encoding", "gzip");
                const recompressed_data = zlib.gzipSync(data);
                res.send(Buffer.from(recompressed_data));
            } else {
                res.send(Buffer.from(data));
            }
        } else {
            res.status(204).send('')
        }
    } catch (err) {
        Err.respond(err, res);
    }
})

export const handler = serverless(app);

const startServer = async () => {
    app.listen(5002, () => {
        console.log('ok - tile server on localhost:5002');
    });
};

startServer();

