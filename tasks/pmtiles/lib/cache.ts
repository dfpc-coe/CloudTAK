import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Rendered tile cache on a local directory - the EFS mount in the Lambda.
 * Disabled when TILE_CACHE_DIR is unset; read and write failures only log so a
 * cache problem never fails a tile.
 */
export default class TileCache {
    static DEFAULT_TTL_SECONDS = 86400;

    static #shared?: TileCache;

    readonly dir: string | null;
    readonly ttl: number;

    constructor(dir: string | null, ttlSeconds = TileCache.DEFAULT_TTL_SECONDS) {
        this.dir = dir;
        this.ttl = ttlSeconds;
    }

    static fromEnv(): TileCache {
        const ttl = Number(process.env.TILE_CACHE_TTL);
        return new TileCache(process.env.TILE_CACHE_DIR || null, ttl > 0 ? ttl : TileCache.DEFAULT_TTL_SECONDS);
    }

    static shared(): TileCache {
        if (!TileCache.#shared) TileCache.#shared = TileCache.fromEnv();
        return TileCache.#shared;
    }

    static reset(): void {
        TileCache.#shared = undefined;
    }

    get enabled(): boolean {
        return this.dir !== null;
    }

    #file(key: string): string {
        if (!/^[A-Za-z0-9_/.-]+$/.test(key) || key.includes('..') || key.startsWith('/')) {
            throw new Error(`Invalid cache key: ${key}`);
        }

        return path.join(this.dir!, key);
    }

    async get(key: string): Promise<Buffer | null> {
        if (!this.dir) return null;

        try {
            const file = this.#file(key);
            const stat = await fs.stat(file);
            if (Date.now() - stat.mtimeMs > this.ttl * 1000) return null;

            return await fs.readFile(file);
        } catch (err) {
            if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
            console.warn('tile cache read failed', err);
            return null;
        }
    }

    async set(key: string, data: Buffer): Promise<void> {
        if (!this.dir) return;

        try {
            const file = this.#file(key);
            await fs.mkdir(path.dirname(file), { recursive: true });

            const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}`;
            await fs.writeFile(tmp, data);
            await fs.rename(tmp, file);
        } catch (err) {
            console.warn('tile cache write failed', err);
        }
    }
}
