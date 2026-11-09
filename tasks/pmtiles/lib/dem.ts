import type { Raster, Tile, TerrainEncoding, TerrainSource } from '@tak-ps/node-tiles';
import { decodeImage } from '@tak-ps/node-tiles/node';
import TileCache from './cache.js';

export interface DemSourceOptions {
    /** Cache namespace identifying the basemap and its current content */
    prefix: string;
    encoding: TerrainEncoding;
    minzoom: number;
    maxzoom: number;
    /** Raw DEM tile bytes, null where the source has no tile */
    fetch: (tile: Tile) => Promise<Buffer | Uint8Array | null>;
}

/**
 * DEM tiles behind the shading routes. Padded terrain reads up to eight
 * neighbours per rendered tile, and adjacent rendered tiles read the same
 * neighbours, so raw tiles are cached on EFS (misses as empty files) to share
 * one upstream fetch across containers, and decoded rasters are kept in a
 * per-container LRU so a warm container decodes each DEM tile once.
 */
export default class DemSource implements TerrainSource {
    static MAX_DECODED = 48;

    static #decoded = new Map<string, Raster>();

    readonly encoding: TerrainEncoding;
    readonly minzoom: number;
    readonly maxzoom: number;

    readonly #prefix: string;
    readonly #fetch: DemSourceOptions['fetch'];

    constructor(opts: DemSourceOptions) {
        this.encoding = opts.encoding;
        this.minzoom = opts.minzoom;
        this.maxzoom = opts.maxzoom;
        this.#prefix = opts.prefix;
        this.#fetch = opts.fetch;
    }

    static reset(): void {
        DemSource.#decoded.clear();
    }

    async tile(tile: Tile): Promise<Raster | null> {
        const key = `dem/${this.#prefix}/${tile.z}/${tile.x}/${tile.y}`;
        const decoded = DemSource.#decoded;

        const hit = decoded.get(key);
        if (hit) {
            decoded.delete(key);
            decoded.set(key, hit);
            return hit;
        }

        const cache = TileCache.shared();
        const cached = await cache.get(key);

        let raw: Buffer | null;
        let raster: Raster | null = null;

        if (cached) {
            raw = cached.length ? cached : null;
            if (raw) raster = await decodeImage(raw);
        } else {
            const fetched = await this.#fetch(tile);
            raw = fetched ? Buffer.from(fetched.buffer, fetched.byteOffset, fetched.byteLength) : null;
            if (raw) raster = await decodeImage(raw);
            await cache.set(key, raw ?? Buffer.alloc(0));
        }

        if (raster) {
            decoded.set(key, raster);
            while (decoded.size > DemSource.MAX_DECODED) {
                decoded.delete(decoded.keys().next().value!);
            }
        }

        return raster;
    }
}
