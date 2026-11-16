import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import TileCache from '../lib/cache.js';

let dir: string;

test('Setup', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pmtiles-cache-'));
});

test('cache: disabled without a directory', async () => {
    const cache = new TileCache(null);

    assert.equal(cache.enabled, false);
    assert.equal(await cache.get('a/b.png'), null);
    await cache.set('a/b.png', Buffer.from('x'));
    assert.equal(await cache.get('a/b.png'), null);
});

test('cache: round trips a tile under the key path', async () => {
    const cache = new TileCache(dir);
    const data = Buffer.from('tile bytes');

    assert.equal(await cache.get('composite/abc/3/1/2.png'), null);

    await cache.set('composite/abc/3/1/2.png', data);

    assert.deepEqual(await cache.get('composite/abc/3/1/2.png'), data);
    assert.deepEqual(await fs.readFile(path.join(dir, 'composite/abc/3/1/2.png')), data);
    assert.deepEqual(await fs.readdir(path.join(dir, 'composite/abc/3/1')), ['2.png'], 'no temp file left behind');
});

test('cache: entries older than the TTL are misses', async () => {
    const cache = new TileCache(dir, 60);
    const file = path.join(dir, 'slope/old.png');

    await cache.set('slope/old.png', Buffer.from('stale'));
    assert.ok(await cache.get('slope/old.png'));

    const past = new Date(Date.now() - 120 * 1000);
    await fs.utimes(file, past, past);

    assert.equal(await cache.get('slope/old.png'), null);
});

test('cache: unsafe keys never touch the filesystem', async (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const cache = new TileCache(dir);

    for (const key of ['../escape.png', '/abs.png', 'a b.png', 'x/../../y.png']) {
        await cache.set(key, Buffer.from('x'));
        assert.equal(await cache.get(key), null);
    }

    assert.equal(warn.mock.callCount(), 8);
    await assert.rejects(fs.access(path.join(os.tmpdir(), 'escape.png')));
});

test('cache: shared instance is configured from the environment', () => {
    TileCache.reset();
    process.env.TILE_CACHE_DIR = dir;
    process.env.TILE_CACHE_TTL = '30';

    const shared = TileCache.shared();
    assert.equal(shared.dir, dir);
    assert.equal(shared.ttl, 30);
    assert.equal(TileCache.shared(), shared);

    TileCache.reset();
    delete process.env.TILE_CACHE_DIR;
    process.env.TILE_CACHE_TTL = 'not a number';

    const disabled = TileCache.shared();
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.ttl, TileCache.DEFAULT_TTL_SECONDS);

    TileCache.reset();
    delete process.env.TILE_CACHE_TTL;
});

test('Teardown', async () => {
    await fs.rm(dir, { recursive: true, force: true });
});
