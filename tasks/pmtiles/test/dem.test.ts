import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Tile } from '@tak-ps/node-tiles';
import TileCache from '../lib/cache.js';
import DemSource from '../lib/dem.js';
import { demTile } from './lib/dem.js';

let dir: string;
let png: Uint8Array;

const DEM = new Tile(12, 2048, 1024);

function source(fetch: (tile: Tile) => Promise<Uint8Array | null>, prefix = 'abc'): DemSource {
    return new DemSource({ prefix, encoding: 'mapbox', minzoom: 4, maxzoom: 12, fetch });
}

test('Setup', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pmtiles-dem-'));
    png = await demTile(1500, { tile: DEM, size: 8 });
});

test('dem: decoded tiles are served from memory, then from the raw cache', async () => {
    process.env.TILE_CACHE_DIR = dir;
    TileCache.reset();
    DemSource.reset();

    let fetches = 0;
    const dem = source(async () => {
        fetches++;
        return png;
    });

    const first = await dem.tile(DEM);
    assert.ok(first);
    assert.equal(first.width, 8);
    assert.equal(fetches, 1);

    assert.equal(await dem.tile(DEM), first, 'same raster from the LRU');
    assert.equal(fetches, 1);

    DemSource.reset();

    const again = await dem.tile(DEM);
    assert.ok(again);
    assert.notEqual(again, first, 'decoded afresh');
    assert.deepEqual(again.data, first.data);
    assert.equal(fetches, 1, 'raw bytes came from the tile cache');

    assert.equal((await fs.readFile(path.join(dir, 'dem/abc/12/2048/1024'))).length, png.length);
});

test('dem: misses are cached, decode failures are not', async () => {
    process.env.TILE_CACHE_DIR = dir;
    TileCache.reset();
    DemSource.reset();

    let misses = 0;
    const missing = source(async () => {
        misses++;
        return null;
    }, 'missing');

    assert.equal(await missing.tile(DEM), null);
    assert.equal(await missing.tile(DEM), null);
    assert.equal(misses, 1);
    assert.equal((await fs.readFile(path.join(dir, 'dem/missing/12/2048/1024'))).length, 0);

    let garbage = 0;
    const broken = source(async () => {
        garbage++;
        return new TextEncoder().encode('not a tile');
    }, 'broken');

    await assert.rejects(broken.tile(DEM), /not a supported raster image/);
    await assert.rejects(broken.tile(DEM), /not a supported raster image/);
    assert.equal(garbage, 2);
    await assert.rejects(fs.stat(path.join(dir, 'dem/broken/12/2048/1024')), { code: 'ENOENT' });
});

test('dem: the decoded LRU evicts the least recently used tile', async () => {
    delete process.env.TILE_CACHE_DIR;
    TileCache.reset();
    DemSource.reset();

    const max = DemSource.MAX_DECODED;
    DemSource.MAX_DECODED = 2;

    try {
        const fetched: string[] = [];
        const dem = source(async (tile) => {
            fetched.push(String(tile));
            return png;
        });

        const a = DEM;
        const b = DEM.neighbor(1, 0)!;
        const c = DEM.neighbor(0, 1)!;

        await dem.tile(a);
        await dem.tile(b);
        await dem.tile(a);
        await dem.tile(c);
        assert.equal(fetched.length, 3);

        await dem.tile(a);
        assert.equal(fetched.length, 3, 'a was touched after b and survived');

        await dem.tile(b);
        assert.equal(fetched.length, 4, 'b was evicted');
    } finally {
        DemSource.MAX_DECODED = max;
    }
});

test('Teardown', async () => {
    TileCache.reset();
    DemSource.reset();
    await fs.rm(dir, { recursive: true, force: true });
});
