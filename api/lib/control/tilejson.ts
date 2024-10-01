import undici from 'undici';
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
        const pathname = decodeURIComponent(url.pathname).replace(/\{\$/, '{');

        if (
            !(pathname.includes('{z}') && pathname.includes('{x}') && pathname.includes('{y}'))
            && !pathname.includes('{q}')
        ) {
            throw new Err(400, null, 'Either ZXY or Quadkey variables must be used');
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
        const url = new URL(config.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y))
            .replace(/\{\$?q\}/, String(this.quadkey(z, x, y)))
        );

        if (!opts) opts = {};
        if (!opts.headers) opts.headers = {};

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
