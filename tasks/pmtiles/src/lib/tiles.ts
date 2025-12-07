import { createHash } from "crypto";
import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { Static, Type } from '@sinclair/typebox'
import { S3Source, nativeDecompress, CACHE } from '../lib/pmtiles.js';
import * as pmtiles from 'pmtiles';
import zlib from "zlib";
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import tileCover from '@mapbox/tile-cover';
import { PromisePool } from '@supercharge/promise-pool';
// @ts-expect-error No Type Defs
import vtquery from '@mapbox/vtquery';
import { pointToTile } from '@mapbox/tilebelt';

export const TileJSON = Type.Object({
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
});

export const QueryResponse = Type.Object({
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
});

export const FeaturesResponse = Type.Object({
    type: Type.Literal('FeatureCollection'),
    features: Type.Array(Type.Object({
        type: Type.Literal('Feature'),
        properties: Type.Record(Type.String(), Type.Unknown()),
        geometry: Type.Object({
            type: Type.String(),
            coordinates: Type.Array(Type.Unknown())
        })
    }))
});

export class FileTiles {
    path: string;

    constructor(path: string) {
        this.path = path;
    }

    /**
     * Return the TileJSON for the given PMTiles archive
     *
     * @param token - The token to use for the tile URL
     */
    async tilejson(
        token: string
    ): Promise<Static<typeof TileJSON>> {
        const p = new pmtiles.PMTiles(new S3Source(this.path), CACHE, nativeDecompress);
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

        return {
            tilejson: "2.2.0",
            name: `${this.path}.pmtiles`,
            description: "Hosted by CloudTAK",
            version: "1.0.0",
            scheme: "xyz",
            tiles: [ process.env.PMTILES_URL + `/tiles/${this.path}/tiles/{z}/{x}/{y}.${format}?token=${token}`],
            minzoom: header.minZoom,
            maxzoom: header.maxZoom,
            bounds: [ header.minLon, header.minLat, header.maxLon, header.maxLat ],
            meta: header,
            center: [ header.centerLon, header.centerLat, header.centerZoom ]
        };
    }

    /**
     * Query the PMTiles archive for features at a given point
     *
     * @param rawQuery - The query string (lng,lat)
     * @param opts - Options for the query
     * @param opts.zoom - The zoom level to query at
     * @param opts.limit - The number of features to return
     */
    async query(
        rawQuery: string,
        opts: {
            zoom?: number,
            limit: number
        } = {
            limit: 1
        }
    ): Promise<Static<typeof QueryResponse>> {
        const p = new pmtiles.PMTiles(new S3Source(this.path), CACHE, nativeDecompress);
        const header = await p.getHeader();

        const query: {
            lnglat: number[],
            zoom: number,
            limit: number
        } = {
            lnglat: [],
            zoom: opts.zoom || header.maxZoom,
            limit: opts.limit
        }

        const lnglat: number[] = rawQuery
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
            return {
                type: 'FeatureCollection',
                query,
                meta,
                features: []
            };
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

            return fc;
        }
    }

    /**
     * Return all features in a given tile
     *
     * @param z - The Z coordinate
     * @param x - The X coordinate
     * @param y - The Y coordinate
     * @param opts - Options for the query
     * @param opts.layer - The layer to return features for
     */
    /**
     * Return all features in a given tile
     *
     * @param z - The Z coordinate
     * @param x - The X coordinate
     * @param y - The Y coordinate
     * @param opts - Options for the query
     * @param opts.layer - The layer to return features for
     */
    async features(
        z: number,
        x: number,
        y: number,
        opts: {
            layer?: string
        } = {}
    ): Promise<Static<typeof FeaturesResponse>> {
        const p = new pmtiles.PMTiles(new S3Source(this.path), CACHE, nativeDecompress);
        const header = await p.getHeader();

        if (z < header.minZoom || z > header.maxZoom) {
            throw new Err(404, null, 'Tile Not Found');
        }

        const tile_result = await p.getZxy(z, x, y);
        if (!tile_result) {
            return {
                type: 'FeatureCollection',
                features: []
            };
        }

        const features: any[] = [];

        if (header.tileType === pmtiles.TileType.Mvt) {
            const tile = new VectorTile(new Pbf(tile_result.data));

            const layers = opts.layer ? [opts.layer] : Object.keys(tile.layers);

            for (const layerName of layers) {
                if (!tile.layers[layerName]) continue;
                const layer = tile.layers[layerName];

                for (let i = 0; i < layer.length; i++) {
                    const feature = layer.feature(i);
                    features.push(feature.toGeoJSON(x, y, z));
                }
            }
        } else {
            throw new Err(400, null, 'Tile is not MVT');
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    /**
     * Return all features in a given bbox
     *
     * @param bbox - The BBOX to query
     * @param opts - Options for the query
     * @param opts.layer - The layer to return features for
     * @param opts.zoom - The zoom level to query at (default: maxzoom)
     */
    async featuresByBounds(
        bbox: number[],
        opts: {
            layer?: string,
            zoom?: number
        } = {}
    ): Promise<Static<typeof FeaturesResponse>> {
        const p = new pmtiles.PMTiles(new S3Source(this.path), CACHE, nativeDecompress);
        const header = await p.getHeader();

        const zoom = opts.zoom || header.maxZoom;
        if (zoom > header.maxZoom) throw new Err(400, null, "Above Layer MaxZoom");
        if (zoom < header.minZoom) throw new Err(400, null, "Below Layer MinZoom");

        const geom: GeoJSON.Geometry = {
            type: 'Polygon',
            coordinates: [[
                [bbox[0], bbox[1]],
                [bbox[2], bbox[1]],
                [bbox[2], bbox[3]],
                [bbox[0], bbox[3]],
                [bbox[0], bbox[1]]
            ]]
        };

        const tiles = tileCover.tiles(geom, {
            min_zoom: zoom,
            max_zoom: zoom
        });

        if (header.tileType !== pmtiles.TileType.Mvt) {
             throw new Err(400, null, 'Tile is not MVT');
        }

        const { results } = await PromisePool
            .withConcurrency(10)
            .for(tiles)
            .process(async ([x, y, z]) => {
                const tile_result = await p.getZxy(z, x, y);
                if (!tile_result) return [];

                const features: any[] = [];

                const tile = new VectorTile(new Pbf(tile_result.data));

                const layers = opts.layer ? [opts.layer] : Object.keys(tile.layers);

                for (const layerName of layers) {
                    if (!tile.layers[layerName]) continue;
                    const layer = tile.layers[layerName];

                    for (let i = 0; i < layer.length; i++) {
                        const feature = layer.feature(i);
                        features.push(feature.toGeoJSON(x, y, z));
                    }
                }

                return features;
            });

        const features: any[] = [];
        for (const result of results) {
            features.push(...result);
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    /**
     * Return a tile for the given ZXY coordinates
     *
     * @param res - The Express response object
     * @param z - The Z coordinate
     * @param x - The X coordinate
     * @param y - The Y coordinate
     * @param ext - The extension of the tile
     */
    async tile(
        res: Response,
        z: number,
        x: number,
        y: number,
        ext: string,
    ): Promise<void> {
        const p = new pmtiles.PMTiles(new S3Source(this.path), CACHE, nativeDecompress);
        const header = await p.getHeader();

        if (z < header.minZoom || z > header.maxZoom) {
            throw new Err(404, null, 'Tile Not Found');
        }

        for (const pair of [
            [pmtiles.TileType.Mvt, "mvt"],
            [pmtiles.TileType.Png, "png"],
            [pmtiles.TileType.Jpeg, "jpg"],
            [pmtiles.TileType.Webp, "webp"],
            [pmtiles.TileType.Avif, "avif"],
        ]) {
            if (header.tileType === pair[0] && ext !== pair[1]) {
                if (header.tileType == pmtiles.TileType.Mvt && ext === "pbf") {
                    // allow this for now. Eventually we will delete this in favor of .mvt
                    continue;
                }

                throw new Err(400, null, "Bad request: archive has type ." + pair[1]);
            }
        }

        const tile_result = await p.getZxy(z, x, y);

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

            res.set("Cache-Control", tile_result.cacheControl || "private, max-age=86400");
            res.set('ETag', tile_result.etag || `"${createHash("sha256").update(Buffer.from(data)).digest("hex")}"`);

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
            res.status(204).send('');
        }
    }
}

