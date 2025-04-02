import undici from 'undici';
import geojsonvt from 'geojson-vt';
import { tileToBBOX } from '../tilebelt.js';
// @ts-expect-error No Type Defs
import vtpbf from 'vt-pbf';
import type { BBox } from 'geojson';
import type { Response } from 'express';
import { pointOnFeature } from '@turf/point-on-feature';
import { bboxPolygon } from '@turf/bbox-polygon';
import { Static, Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

export const TileJSONType = Type.Object({
    tilejson: Type.String(),
    version: Type.String(),
    name: Type.String(),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    tiles: Type.Array(Type.String()),
    bounds: Type.Array(Type.Number()),
    center: Type.Array(Type.Number()),
    type: Type.String(),
    layers: Type.Array(Type.Unknown()),
    format: Type.Optional(Type.String()),
})

export interface TileJSONInterface {
    name: string;
    url: string;
    bounds?: Array<number>;
    center?: Array<number>;
    type?: string;
    version?: string;
    minzoom?: number;
    maxzoom?: number;
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

        // Consistent Mapbox Style ZXY Endpoints: {z} vs TAK: {$z}
        const pathname = decodeURIComponent(url.pathname).replace(/\{\$/g, '{');

        if (
            !(pathname.includes('{z}') && pathname.includes('{x}') && pathname.includes('{y}'))
            && !pathname.includes('{q}')
            && !pathname.includes('/FeatureServer/')
            && !pathname.includes('/ImageServer')
        ) {
            throw new Err(400, null, 'Either ZXY, Quadkey variables OR ESRI FeatureServer/ImageServer must be used');
        }
    }

    static json(config: TileJSONInterface): Static<typeof TileJSONType> {
        const bounds = config.bounds || [-180, -90, 180, 90];
        const center = config.center || pointOnFeature(bboxPolygon(bounds as BBox)).geometry.coordinates;

        return {
            tilejson: "2.2.0",
            version: config.version || '1.0.0',
            name: config.name,
            type: config.type || 'raster',
            bounds, center,
            minzoom: config.minzoom || 0,
            maxzoom: config.maxzoom || 16,
            tiles: [ String(config.url) ],
            layers: []
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
        url.searchParams.append('size', '256,256');

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

        if (config.url.includes("/ImageServer")) {
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
        } else if (config.url.includes("/FeatureServer/")) {
            try {
                const url = this.esriVectorTileURL(config.url, z, x, y)

                const tileRes = await fetch(url);

                if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

                const fc = await tileRes.json();

                if (!fc.features.length) {
                    res.status(404).json({
                        status: 404,
                        message: 'No Features Found'
                    });

                    return;
                }

                const tiles = geojsonvt(fc, {
                    maxZoom: 24,
                    tolerance: 3,
                    extent: 4096,
                    buffer: 64,
                });

                const tile = vtpbf.fromGeojsonVt({ 'out': tiles.getTile(z, x, y) });

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
                    maxRedirections: 3,
                    headers: opts.headers
                }, ({ statusCode, headers, body }) => {
                    if (headers) {
                        for (const key in headers) {
                            if (
                                ![
                                    'content-type',
                                    'content-length',
                                    'content-encoding',
                                    'last-modified',
                                ].includes(key)
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
