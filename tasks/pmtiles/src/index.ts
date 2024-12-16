import express from 'express';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import cors from 'cors';
import S3 from './lib/s3.js';
import * as pmtiles from 'pmtiles'
import { nativeDecompress, CACHE } from './lib/pmtiles.js';
import auth from './lib/auth.js';
import * as pmtiles from 'pmtiles';
import zlib from "zlib";
import vtquery from '@mapbox/vtquery';
import TB from '@mapbox/tilebelt';
import serverless from 'serverless-http';

if (!process.env.SigningSecret) throw new Error('SigningSecret env var must be provided');

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
        scheme: Type.Literal('zxy'),
        tiles: Type.Array(Type.String()),
        minzoom: Type.Integer(),
        maxzoom: Type.Integer(),
        bounds: Type.Array(Type.Number()),
        meta: Type.Unknown(),
        cetner: Type.Array(Type.Number())
    })
}, async (req, res) => {
    try {
        const username = auth(req.params.token);

        if (username !== req.params.username) {
            throw new Err(401, null, 'Unauthorized Access');
        }

        const p = new pmtiles.PMTiles(new S3Source(req.params.name), CACHE, nativeDecompress);

        const header = await p.getHeader();

        let format = 'mvt';
        for (const pair of [
            [pmtiles.TileType.Mvt, "mvt"],
            [pmtiles.TileType.Png, "png"],
            [pmtiles.TileType.Jpeg, "jpg"],
            [pmtiles.TileType.Webp, "webp"],
        ]) {
            if (header.tileType === pair[0]) format = pair[1];
        }

        res.json({
            "tilejson": "2.2.0",
            "name": `${name}.pmtiles`,
            "description": "Hosted by TAK-ETL",
            "version": "1.0.0",
            "scheme": "xyz",
            "tiles": [ process.env.APIROOT + `/tiles${path}/{z}/{x}/{y}.${format}?token=${event.queryStringParameters.token}`],
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
        const query: {
            lnglat: [number, number],
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

        const xyz = TB.pointToTile(query.lnglat[0], query.lnglat[1], query.zoom)
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

            return res.json(fc);
        }
    } catch (err) {
        Err.respond(err, res);
    }
})

schema.get('/tiles/profile/:username/:file/tiles/:z/:x/:y.:format', {
    name: 'Get Tile',
    group: 'ProfileTiles',
    description: 'Return tile for a given zxy',
    params: Type.Object({
        username: Type.String(),
        file: Type.String(),
        z: Type.Integer(),
        x: Type.Integer(),
        y: Type.Integer()
    }),
}, async (req, res) => {
    try {
        const username = auth(req.params.token);

        if (username !== req.params.username) {
            throw new Err(401, null, 'Unauthorized Access');
        }

        if (!meta && (tile[0] < header.minZoom || tile[0] > header.maxZoom)) {
            throw new Err(404, null, 'File Not Found');
        }

        for (const pair of [
            [pmtiles.TileType.Mvt, "mvt"],
            [pmtiles.TileType.Png, "png"],
            [pmtiles.TileType.Jpeg, "jpg"],
            [pmtiles.TileType.Webp, "webp"],
        ]) {
            if (header.tileType === pair[0] && ext !== pair[1]) {
                if (header.tileType == pmtiles.TileType.Mvt && ext === "pbf") {
                    // allow this for now. Eventually we will delete this in favor of .mvt
                    continue;
                }
                return apiError(400, "Bad request: archive has type ." + pair[1]);
            }
        }

        const tile_result = await p.getZxy(tile[0], tile[1], tile[2]);
        if (tile_result) {
            switch (header.tileType) {
                case pmtiles.TileType.Mvt:
                    // part of the list of Cloudfront compressible types.
                    headers["Content-Type"] = "application/vnd.mapbox-vector-tile";
                break;
                case pmtiles.TileType.Png:
                    headers["Content-Type"] = "image/png";
                break;
                case pmtiles.TileType.Jpeg:
                    headers["Content-Type"] = "image/jpeg";
                break;
                case pmtiles.TileType.Webp:
                    headers["Content-Type"] = "image/webp";
                break;
            }

            let data = tile_result.data;

            // We need to force API Gateway to interpret the Lambda response as binary
            // without depending on clients sending matching Accept: headers in the request.
            const recompressed_data = zlib.gzipSync(data);
            headers["Content-Encoding"] = "gzip";

            /// TODO Send headers
            headers

            return res.send(Buffer.from(recompressed_data).toString("base64"));
        } else {
            return apiResp(204, "", false, headers);
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

