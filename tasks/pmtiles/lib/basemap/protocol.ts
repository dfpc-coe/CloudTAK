import type { Response } from 'express';
import type { Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import undici from 'undici';
import { isSafeUrl } from '@tak-ps/node-safeurl';
import { tileToBBOX } from '../tilebelt.js';
import { TileJSON, TileJSONActions } from '../tilejson.js';
import type { BasemapConfig } from '../basemap.js';

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
    vector_layers?: Array<{ id: string; fields: Record<string, string>; minzoom?: number; maxzoom?: number; description?: string }>;
}

export interface TileOpts {
    headers?: Record<string, string | undefined>;
}

// Synchronous Lambda responses cap at 6 MiB after base64 encoding
export const MAX_TILE_BYTES = Math.floor((6 * 1024 * 1024) * 3 / 4);

export function assertTileSize(bytes: number): void {
    if (bytes > MAX_TILE_BYTES) {
        throw new Err(413, null, `Tile exceeds the ${MAX_TILE_BYTES} byte response limit`);
    }
}

/**
 * Base class for basemap tile protocols, mirroring the CloudTAK API
 * BasemapProtocol. Subclasses implement _tile() to proxy or render a tile.
 */
export class BasemapProtocol {
    basemap: BasemapConfig;

    constructor(basemap: BasemapConfig) {
        this.basemap = basemap;
    }

    static json(config: TileJSONInterface): Static<typeof TileJSON> {
        const bounds = (config.bounds as [number, number, number, number]) || [-180, -90, 180, 90];

        // TileJSON 3.0.0 centers are [longitude, latitude, zoom]
        const lonlat = config.center && config.center.length >= 2
            ? config.center.slice(0, 2)
            : [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
        const zoom = config.center && config.center.length >= 3
            ? config.center[2]
            : Math.round(((config.minzoom ?? 0) + (config.maxzoom ?? 16)) / 2);
        const center = [...lonlat, zoom];

        const type = config.type || 'raster';
        const isVectorType = type !== 'raster' && type !== 'raster-dem';

        let vector_layers: TileJSONInterface['vector_layers'];
        if (isVectorType) {
            vector_layers = config.vector_layers
                ? [...config.vector_layers]
                : [{ id: 'out', fields: {} }];
        }

        return {
            tilejson: '3.0.0',
            version: config.version || '1.0.0',
            name: config.name,
            description: '',
            scheme: 'xyz',
            type,
            bounds,
            center,
            attribution: config.attribution || undefined,
            tileSize: config.tilesize,
            minzoom: config.minzoom ?? 0,
            maxzoom: config.maxzoom ?? 16,
            tiles: [String(config.url)],
            vector_layers,
        };
    }

    static extent(z: number, x: number, y: number): Array<number> {
        return tileToBBOX([x, y, z]);
    }

    static quadkey(z: number, x: number, y: number): string {
        const quadKey = [];
        for (let i = z; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) !== 0) digit++;
            if ((y & mask) !== 0) {
                digit++;
                digit++;
            }
            quadKey.push(digit);
        }
        return quadKey.join('');
    }

    actions(): Static<typeof TileJSONActions> {
        return {
            feature: [],
        };
    }

    /**
     * Proxy a tile request to the upstream source after header normalisation
     * and a bounds short-circuit for basemaps with a stored extent.
     */
    async tile(
        z: number, x: number, y: number,
        res: Response,
        opts?: TileOpts,
    ): Promise<void> {
        const headers: Record<string, string | undefined> = { ...opts?.headers };
        for (const key of Object.keys(headers)) {
            if (!headers[key]) delete headers[key];
        }

        const bounds = this.basemap.bounds;
        if (bounds && bounds.length === 4) {
            const tileBbox = tileToBBOX([x, y, z]);
            const [minLon, minLat, maxLon, maxLat] = bounds;
            const [tileMinLon, tileMinLat, tileMaxLon, tileMaxLat] = tileBbox;

            if (tileMaxLat < minLat || tileMinLat > maxLat) {
                res.status(404).send('Tile outside bounds');
                return;
            }

            const lonInBox = minLon <= maxLon
                ? tileMinLon <= maxLon && tileMaxLon >= minLon
                : tileMinLon <= maxLon || tileMaxLon >= minLon;

            if (!lonInBox) {
                res.status(404).send('Tile outside bounds');
                return;
            }
        }

        return this._tile(z, x, y, res, { headers });
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        void z;
        void x;
        void y;
        void res;
        void opts;
        throw new Err(501, null, 'Protocol does not implement tile()');
    }

    /**
     * Stream an upstream tile response to the client, forwarding only the
     * headers the CloudTAK API tile proxy forwards.
     */
    protected async pipe(url: URL, res: Response, opts: Required<TileOpts>): Promise<void> {
        try {
            if (process.env.StackName !== 'test') {
                const { safe, reason } = await isSafeUrl(url.href);
                if (!safe) throw new Err(400, null, `Blocked tile URL: ${reason}`);
            }

            const upstream = await undici.request(url, {
                method: 'GET',
                headers: opts.headers as Record<string, string>,
            });

            const contentLength = Number(upstream.headers['content-length']);
            if (upstream.statusCode === 200 && !isNaN(contentLength)) {
                try {
                    assertTileSize(contentLength);
                } catch (err) {
                    upstream.body.destroy();
                    throw err;
                }
            }

            const headers: Record<string, string | string[]> = {};
            for (const [key, value] of Object.entries(upstream.headers)) {
                if (value === undefined) continue;
                if ([
                    'content-type',
                    'content-length',
                    'cache-control',
                    'content-encoding',
                    'last-modified',
                ].includes(key.toLowerCase())) {
                    headers[key] = value;
                }
            }

            res.writeHead(upstream.statusCode, headers);

            let received = 0;

            await new Promise<void>((resolve, reject) => {
                upstream.body
                    .on('data', (buf) => {
                        received += buf.length;

                        if (received > MAX_TILE_BYTES) {
                            upstream.body.destroy(new Err(413, null, `Tile exceeds the ${MAX_TILE_BYTES} byte response limit`));
                            return;
                        }

                        res.write(buf);
                    })
                    .on('error', (err) => {
                        res.end();
                        reject(err);
                    })
                    .on('end', () => {
                        res.end();
                        resolve();
                    });
            });
        } catch (err) {
            if (res.headersSent || err instanceof Err) throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch tile');
        }
    }
}
