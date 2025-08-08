import undici from 'undici';
import geojsonvt from 'geojson-vt';
import { tileToBBOX } from '../tilebelt.js';
// @ts-expect-error No Type Defs
import vtpbf from 'vt-pbf';
import type { BBox } from 'geojson';
import type { Response } from 'express';
import { fetch } from '@tak-ps/etl'
import { GeoJSONFeatureCollection, GeoJSONFeature } from '../types.js';
import { pointOnFeature } from '@turf/point-on-feature';
import { bboxPolygon } from '@turf/bbox-polygon';
import { Static, Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import { Basemap_FeatureAction } from '../enums.js';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

export const TileJSONActions = Type.Object({
    feature: Type.Array(Type.Enum(Basemap_FeatureAction))
})

export const VectorLayer = Type.Object({
    id: Type.String(),
    fields: Type.Record(Type.String(), Type.String()),

    minzoom: Type.Optional(Type.Integer()),
    maxzoom: Type.Optional(Type.Integer()),
    description: Type.Optional(Type.String())
});

export const TileJSONType = Type.Object({
    tilejson: Type.Literal('3.0.0'),
    version: Type.String(),
    scheme: Type.Literal('xyz'),

    name: Type.String(),
    description: Type.String(),
    attribution: Type.Optional(Type.String()),

    // This is a custom attribute and not in the original TileJSON spec
    tileSize: Type.Optional(Type.Integer()),

    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    tiles: Type.Array(Type.String()),
    bounds: Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()]),
    center: Type.Array(Type.Number()),
    type: Type.String(),
    format: Type.Optional(Type.String()),

    vector_layers: Type.Array(VectorLayer)
})

export interface TileJSONInterface {
    name: string;
    url: string;
    description?: string;
    attribution: string | null | undefined;
    tilesize?: number;
    bounds?: Array<number>;
    center?: Array<number>;
    type?: string;
    version?: string;
    minzoom?: number;
    maxzoom?: number;
    vector_layers?: Array<Static<typeof VectorLayer>>
}

export default class TileJSON {
    static isValidStyle(type: string, layers: Array<any>): void {
        const sources: Record<string, unknown> = {};

        for (const l of layers) {
            if (!sources[l.source]) {
                sources[l.source] = { type }
            }
        }

        const errors = validateStyleMin({
            version: 8,
            glyphs: '/fonts/{fontstack}/{range}.pbf',
            sources: sources as any,
            layers: layers as any
        })

        if (errors.length) throw new Err(400, null, JSON.stringify(errors));
    }

    static actions(url?: string): Static<typeof TileJSONActions> {
        const actions: Static<typeof TileJSONActions> = {
            feature: []
        }

        if (!url) return actions;

        if (url.match(/FeatureServer\/\d+/)) {
            actions.feature.push(Basemap_FeatureAction.FETCH)
        } else if (url.match(/MapServer\/\d+/)) {
            actions.feature.push(Basemap_FeatureAction.FETCH)
        }

        return actions;
    }

    static async featureFetch(
        url: string,
        id: string
    ): Promise<Static<typeof GeoJSONFeature>> {
        const actions = TileJSON.actions(url)

        if (!actions.feature.includes(Basemap_FeatureAction.FETCH)) {
            throw new Err(400, null, 'Basemap does not support Feature.FETCH');
        }

        if (url.match(/FeatureServer\/\d+/) || url.match(/MapServer\/\d+/)) {
            const res = await fetch(url + `/query?objectIds=${id}&f=geojson`);

            const fc = await res.typed(GeoJSONFeatureCollection);

            if (fc.features.length === 0) {
                throw new Err(404, null, `Could not find feature with ID: ${id}`);
            } else if (fc.features.length > 1) {
                throw new Err(404, null, `Server returned multiple features with ID: ${id}`);
            }

            const feat = fc.features[0];
            feat.id = id;
            return feat;
        } else {
            throw new Err(500, null, 'Could not determine strategy to fetch Basemap');
        }
    }

    static isValidURL(str: string): void {
        let url: URL;

        try {
            url = new URL(str);
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid URL provided');
        }

        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Err(400, null, 'Only HTTP and HTTPS Protocols are supported');
        }

        // Consistent Mapbox Style XYZ Endpoints: {z} vs TAK: {$z}
        const pathname = decodeURIComponent(url.pathname).replace(/\{\$/g, '{');

        if (
            !(pathname.includes('{z}') && pathname.includes('{x}') && pathname.includes('{y}'))
            && !pathname.includes('{q}')
            && !pathname.match(/\/FeatureServer\/\d+$/)
            && !pathname.match(/\/MapServer\/\d+$/)
            && !pathname.includes('/ImageServer')
        ) {
            throw new Err(400, null, 'Either XYZ, Quadkey variables OR ESRI FeatureServer/ImageServer must be used');
        }
    }

    static json(config: TileJSONInterface): Static<typeof TileJSONType> {
        const bounds = config.bounds as [number, number, number, number ] || [-180, -90, 180, 90];
        const center = config.center || pointOnFeature(bboxPolygon(bounds as BBox)).geometry.coordinates;

        const vector_layers: Array<Static<typeof VectorLayer>> = [];

        if (!config.vector_layers) {
            vector_layers.push({
                id: 'out',
                fields: {}
            });
        } else {
            vector_layers.push(...config.vector_layers);
        }

        return {
            tilejson: "3.0.0",
            version: config.version || '1.0.0',
            name: config.name,
            description: '',
            scheme: 'xyz',
            type: config.type || 'raster',
            bounds,
            center,
            attribution: config.attribution || undefined,
            tileSize: config.tilesize,
            minzoom: config.minzoom || 0,
            maxzoom: config.maxzoom || 16,
            tiles: [ String(config.url) ],
            vector_layers
        }
    }

    static extent(z: number, x: number, y: number): Array<number> {
        return tileToBBOX([x, y, z]);
    }

    static esriRasterTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        if (!url.pathname.endsWith('/exportImage')) {
            url.pathname = url.pathname + '/exportImage'
        }

        url.searchParams.set('f', 'image');

        const bbox = this.extent(z, x, y);

        url.searchParams.append('imageSR', '3857');
        url.searchParams.append('size', '512,512');

        url.searchParams.append('interpolation', 'RSP_CubicConvolution');

        url.searchParams.append('bboxSR', '4326');
        url.searchParams.append('bbox', `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);

        return url
    }

    static esriVectorTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        if (!url.pathname.endsWith('/query')) {
            url.pathname = url.pathname + '/query'
        }

        url.searchParams.set('f', 'geojson');
        url.searchParams.set('inSR', '4326');
        url.searchParams.set('outSR', '4326');
        url.searchParams.set('returnZ', 'false');
        url.searchParams.set('returnM', 'false');

        url.searchParams.set('useStaticZoomLevel', 'false');
        url.searchParams.set('simplifyFactor', '0.3');
        url.searchParams.set('setAttributionFromService', 'true');
        url.searchParams.set('useSeviceBounds', 'true')
        url.searchParams.set('resultType', 'tile')
        url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
        url.searchParams.set('geometryType', 'esriGeometryEnvelope');

        if (!url.searchParams.has('precision')) url.searchParams.set('precision', '8');
        if (!url.searchParams.has('where')) url.searchParams.append('where', '1=1');
        if (!url.searchParams.has('outFields')) url.searchParams.append('outFields', '*');

        const bbox = this.extent(z, x, y);

        const extent = {
            spatialReference: { latestWkid: 4326, wkid: 4326 },
            xmin: bbox[0],
            ymin: bbox[1],
            xmax: bbox[2],
            ymax: bbox[3]
        }

        url.searchParams.set('quantizationParameters', JSON.stringify({
            extent,
            tolerance: 0.001,
            mode: 'view'
        }))

        url.searchParams.set('geometry', JSON.stringify(extent));

        return url;
    }

    /**
     * Generate a Bing Maps style quadkey from a zxy
     */
    static quadkey(z: number, x: number, y: number): string {
        const quadKey = [];
        for (let i = z; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) != 0) {
                digit++;
            }
            if ((y & mask) != 0) {
                digit++;
                digit++;
            }
            quadKey.push(digit);
        }
        return quadKey.join('');
    }

    static async tile(
        config: TileJSONInterface,
        z: number, x: number, y: number,
        res: Response,
        opts?: {
            headers?: Record<string, string | undefined>
        }
    ): Promise<void> {
        if (!opts) opts = {};
        if (!opts.headers) opts.headers = {};

        // Check if tile is within bounds (handle antimeridian crossing)
        if (config.bounds && config.bounds.length === 4) {
            const tileBbox = tileToBBOX([x, y, z]);
            const [minLon, minLat, maxLon, maxLat] = config.bounds;
            const [tileMinLon, tileMinLat, tileMaxLon, tileMaxLat] = tileBbox;

            // Check latitude bounds (simple case)
            if (tileMaxLat < minLat || tileMinLat > maxLat) {
                res.status(404).send('Tile outside bounds');
                return;
            }

            // Check longitude bounds (handle antimeridian crossing)
            const lonInBox = minLon <= maxLon
                ? tileMinLon <= maxLon && tileMaxLon >= minLon
                : tileMinLon <= maxLon || tileMaxLon >= minLon;

            if (!lonInBox) {
                res.status(404).send('Tile outside bounds');
                return;
            }
        }

        if (config.url.endsWith("/ImageServer")) {
            try {
                const url = this.esriRasterTileURL(config.url, z, x, y)

                const tileRes = await fetch(url);

                if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

                const tile = Buffer.from(await tileRes.arrayBuffer());

                res.writeHead(200, {
                    ...opts.headers,
                    'Content-Type': 'image/jpeg',
                    'Content-Length': Buffer.byteLength(tile)
                });

                res.write(tile);
                res.end();
            } catch (err) {
                if (err instanceof Err) {
                    throw err;
                } else {
                    throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI tile')
                }
            }
        } else if (
            config.url.match(/\/FeatureServer\/\d+$/)
            || config.url.match(/\/MapServer\/\d+$/)
        ) {
            try {
                const url = this.esriVectorTileURL(config.url, z, x, y)

                const tileRes = await fetch(url);

                if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

                const fc = await tileRes.typed(GeoJSONFeatureCollection);

                if (!fc.features.length) {
                    res.status(404).json({
                        status: 404,
                        message: 'No Features Found'
                    });

                    return;
                }

                const tiles = geojsonvt({
                    type: 'FeatureCollection',
                    features: fc.features.map((feat) => {
                        // @ts-expect-error Vector Tiles need a int parsable ID
                        feat.id = Number(feat.id);
                        return feat;
                    })
                }, {
                    maxZoom: 24,
                    tolerance: 3,
                    extent: 4096,
                    buffer: 64,
                });

                const tile = vtpbf.fromGeojsonVt({
                    'out': tiles.getTile(z, x, y)
                });

                res.writeHead(200, {
                    ...opts.headers,
                    'Content-Type': 'application/vnd.mapbox-vector-tile',
                    'Content-Length': Buffer.byteLength(tile)
                });

                res.write(tile)
                res.end();
            } catch (err) {
                if (err instanceof Err) {
                    throw err;
                } else {
                    throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI tile')
                }
            }
        } else {
            const url = new URL(config.url
                .replace(/\{\$?z\}/, String(z))
                .replace(/\{\$?x\}/, String(x))
                .replace(/\{\$?y\}/, String(y))
                .replace(/\{\$?q\}/, String(this.quadkey(z, x, y)))
            );

            try {
                const stream = await undici.pipeline(url, {
                    method: 'GET',
                    headers: opts.headers
                }, ({ statusCode, headers, body }) => {
                    if (headers) {
                        for (const key in headers) {
                            if (
                                ![
                                    'content-type',
                                    'content-length',
                                    'cache-control',
                                    'content-encoding',
                                    'last-modified',
                                ].includes(key.toLowerCase())
                            ) {
                                delete headers[key];
                            }
                        }
                    }

                    res.writeHead(statusCode, headers);

                    return body;
                });

                await new Promise((resolve, reject) => {
                    stream
                        .on('data', (buf) => {
                            res.write(buf)
                        })
                        .on('error', (err) => {
                            return reject(err);
                        })
                        .on('end', () => {
                            res.end()
                            // @ts-expect-error Type empty resolve
                            return resolve();
                        })
                        .on('close', () => {
                            res.end()
                            // @ts-expect-error Type empty resolve
                            return resolve();
                        })
                        .end()
                });
            } catch (err) {
                console.error(err);
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch tile')
            }
        }
    }
}
