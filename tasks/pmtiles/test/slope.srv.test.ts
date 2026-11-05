import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { AddressInfo } from 'net';
import { pixel } from './lib/raster.js';

process.env.StackName = 'test';
process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

const SIZE = 64;
const DEM = { z: 12, x: 2048, y: 1024 };
const CENTRE = SIZE / 2;

// z14/8193/4098 sits inside the DEM tile, two zooms below its maxzoom
const OVERZOOMED = '14/8193/4098';

let app: any;
let server: http.Server;
let upstream: http.Server;

const requestedURLs: string[] = [];
const token = jwt.sign({ email: 'user@example.com', access: 'user' }, 'test-secret');

// Planar DEM rising eastward at 33 degrees, terrarium encoded
async function demTile(): Promise<Buffer> {
    const raw = Buffer.alloc(SIZE * SIZE * 3);

    for (let py = 0; py < SIZE; py++) {
        const n = Math.PI - (2 * Math.PI * (DEM.y + (py + 0.5) / SIZE)) / 2 ** DEM.z;
        const cell = (40075016.686 * Math.cos(Math.atan(Math.sinh(n)))) / (2 ** DEM.z * SIZE);

        for (let px = 0; px < SIZE; px++) {
            const value = 1000 + px * cell * Math.tan(33 * Math.PI / 180) + 32768;
            const i = (py * SIZE + px) * 3;
            raw[i] = Math.floor(value / 256);
            raw[i + 1] = Math.floor(value % 256);
            raw[i + 2] = Math.round((value % 1) * 256) & 0xff;
        }
    }

    return await sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer();
}

function baseURL(): string {
    return `http://localhost:${(server.address() as AddressInfo).port}`;
}

function get(route: string, auth: string | null = token): Promise<Response> {
    return fetch(`${baseURL()}${route}${auth ? `${route.includes('?') ? '&' : '?'}token=${auth}` : ''}`);
}

function basemap(id: number, type: string): Record<string, unknown> {
    return {
        id,
        name: 'Terrain',
        updated: '2026-01-01T00:00:00Z',
        url: `${process.env.API_URL}/dem/{z}/{x}/{y}.png`,
        protocol: 'zxy',
        type,
        format: 'png',
        encoding: 'terrarium',
        minzoom: 4,
        maxzoom: 12,
        username: null,
        sharing_enabled: false,
        sharing_token: null,
        tilesize: 256,
        attribution: null,
        scheme: 'xyz',
        overlay: false,
        actions: { feature: [] },
        children: [],
    };
}

test('Setup', async () => {
    process.env.TILE_CACHE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'pmtiles-slope-'));

    const tile = await demTile();

    // Plays both the CloudTAK API (basemap config) and the upstream DEM tile host
    upstream = http.createServer((req, res) => {
        const url = new URL(String(req.url), 'http://127.0.0.1');
        requestedURLs.push(`${url.pathname}?${url.searchParams}`);

        if (url.pathname === '/api/basemap/42') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(basemap(42, 'raster-dem')));
        }

        if (url.pathname === '/api/basemap/43') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(basemap(43, 'raster')));
        }

        if (url.pathname === `/dem/${DEM.z}/${DEM.x}/${DEM.y}.png`) {
            res.writeHead(200, { 'content-type': 'image/png' });
            return res.end(tile);
        }

        if (url.pathname.startsWith('/dem/')) {
            res.writeHead(404);
            return res.end();
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 404, message: 'Item Not Found' }));
    });

    await new Promise<void>((resolve) => {
        upstream.listen(0, '127.0.0.1', () => resolve());
    });

    process.env.API_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    process.env.PMTILES_URL = process.env.API_URL;

    const mod = await import('../index.js');
    app = mod.app;

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
    });
});

test('TileJSON: default avalanche classes', async () => {
    const res = await get('/tiles/slope/42');

    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.name, 'Terrain');
    assert.equal(body.type, 'raster');
    assert.equal(body.format, 'png');
    assert.equal(body.encoding, undefined);
    assert.equal(body.minzoom, 4);
    assert.equal(body.maxzoom, 16, 'DEM maxzoom plus overzoom');
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/slope/42/tiles/{z}/{x}/{y}?token=${token}`]);
    assert.deepEqual(body.legend.map((entry: { label: string }) => entry.label), ['27-30°', '30-35°', '35-45°', '45-50°', '50°+']);
});

test('TileJSON: bearer auth yields token-free tile URLs', async () => {
    const res = await fetch(`${baseURL()}/tiles/slope/42`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).tiles, [`${process.env.PMTILES_URL}/tiles/slope/42/tiles/{z}/{x}/{y}`]);
});

test('TileJSON: requested layers are normalised onto the tile URL and the legend', async () => {
    const res = await get('/tiles/slope/42?layer=0:30:00ff00&layer=30:90:%23ff0000c8');

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/slope/42/tiles/{z}/{x}/{y}?layer=0:30:00ff00&layer=30:90:ff0000c8&token=${token}`]);
    assert.deepEqual(body.legend, [
        { label: '0-30°', color: 'rgba(0, 255, 0, 1)' },
        { label: '30°+', color: 'rgba(255, 0, 0, 0.78)' },
    ]);

    const single = await fetch(`${baseURL()}/tiles/slope/42?layer=30:45:ff9800`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(single.status, 200);
    assert.deepEqual((await single.json()).tiles, [`${process.env.PMTILES_URL}/tiles/slope/42/tiles/{z}/{x}/{y}?layer=30:45:ff9800`]);
});

test('tile: renders from the upstream DEM with one in-process fetch', async () => {
    requestedURLs.length = 0;

    const res = await get(`/tiles/slope/42/tiles/${OVERZOOMED}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('cache-control'), 'private, max-age=86400');
    assert.match(res.headers.get('etag') || '', /^"[0-9a-f]{64}"$/);
    assert.deepEqual(requestedURLs, ['/dem/12/2048/1024.png?']);

    assert.deepEqual(await pixel(await res.arrayBuffer(), CENTRE, CENTRE), [255, 152, 0, 200], '33° falls in the 30-35° class');
});

test('tile: requested layers change the rendering', async () => {
    const red = await get(`/tiles/slope/42/tiles/${OVERZOOMED}?layer=0:30:00ff00&layer=30:90:ff0000c8`);
    assert.equal(red.status, 200);
    assert.deepEqual(await pixel(await red.arrayBuffer(), CENTRE, CENTRE), [255, 0, 0, 200]);

    const clear = await get(`/tiles/slope/42/tiles/${OVERZOOMED}?layer=40:90:ff0000`);
    assert.equal(clear.status, 200);
    assert.equal((await pixel(await clear.arrayBuffer(), CENTRE, CENTRE))[3], 0, '33° is below every band');
});

test('tile: cache entries are keyed by basemap and layers', async () => {
    requestedURLs.length = 0;

    const res = await get(`/tiles/slope/42/tiles/${OVERZOOMED}`);
    assert.equal(res.status, 200);
    assert.deepEqual(requestedURLs, [], 'served from cache');

    const keys = await fs.readdir(path.join(process.env.TILE_CACHE_DIR!, 'slope'));
    assert.equal(keys.length, 3, 'default classes plus two custom layer sets');
});

test('tile: 204 where the DEM has no tile', async () => {
    const res = await get('/tiles/slope/42/tiles/12/0/0');

    assert.equal(res.status, 204);
});

test('tile: 404 outside the shaded zoom range', async () => {
    assert.equal((await get('/tiles/slope/42/tiles/3/0/0')).status, 404);
    assert.equal((await get('/tiles/slope/42/tiles/17/0/0')).status, 404);
});

test('both routes reject malformed layers', async () => {
    const tilejson = await get('/tiles/slope/42?layer=30:45');
    assert.equal(tilejson.status, 400);
    assert.equal((await tilejson.json()).message, 'Invalid slope layer "30:45": expected lower:upper:hex_color');

    const tile = await get(`/tiles/slope/42/tiles/${OVERZOOMED}?layer=45:30:ff0000`);
    assert.equal(tile.status, 400);
    assert.equal((await tile.json()).message, 'Invalid slope layer "45:30:ff0000": expected 0 <= lower < upper <= 90');
});

test('both routes reject basemaps that are not raster-dem', async () => {
    const tilejson = await get('/tiles/slope/43');
    assert.equal(tilejson.status, 400);
    assert.equal((await tilejson.json()).message, 'Slope shading requires a raster-dem basemap');

    const tile = await get('/tiles/slope/43/tiles/12/2048/1024');
    assert.equal(tile.status, 400);
    assert.equal((await tile.json()).message, 'Slope shading requires a raster-dem basemap');
});

test('both routes require auth', async () => {
    assert.equal((await get('/tiles/slope/42', null)).status, 401);
    assert.equal((await get(`/tiles/slope/42/tiles/${OVERZOOMED}`, null)).status, 401);
});

test('Teardown', async () => {
    await fs.rm(process.env.TILE_CACHE_DIR!, { recursive: true, force: true });

    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([server, upstream].map(s => new Promise<void>((resolve) => {
        s.close(() => resolve());
    })));

    process.exit(0);
});
