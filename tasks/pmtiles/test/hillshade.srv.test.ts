import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Tile } from '@tak-ps/node-tiles';
import type { AddressInfo } from 'net';
import { pixel } from './lib/raster.js';
import { demTile, plane } from './lib/dem.js';

process.env.StackName = 'test';
process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

const SIZE = 64;
const DEM = new Tile(12, 2048, 1024);
const EAST = DEM.neighbor(1, 0)!;
const CENTRE = SIZE / 2;

// z14/8193/4098 sits inside the DEM tile, two zooms below its maxzoom
const OVERZOOMED = '14/8193/4098';

let app: any;
let server: http.Server;
let upstream: http.Server;

const requestedURLs: string[] = [];
const token = jwt.sign({ email: 'user@example.com', access: 'user' }, 'test-secret');

function baseURL(): string {
    return `http://localhost:${(server.address() as AddressInfo).port}`;
}

function get(route: string, auth: string | null = token): Promise<Response> {
    return fetch(`${baseURL()}${route}${auth ? `${route.includes('?') ? '&' : '?'}token=${auth}` : ''}`);
}

function demURL(tile: Tile): string {
    return `/dem/${tile.z}/${tile.x}/${tile.y}.png?`;
}

function neighbourhood(tile: Tile): string[] {
    const urls: string[] = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            urls.push(demURL(tile.neighbor(dx, dy)!));
        }
    }
    return urls.sort();
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
    process.env.TILE_CACHE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'pmtiles-hillshade-'));

    const tile = await demTile(plane(33, DEM, SIZE), { tile: DEM, size: SIZE, encoding: 'terrarium' });

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

        if (url.pathname === `/dem/${DEM.z}/${DEM.x}/${DEM.y}.png` || url.pathname === `/dem/${EAST.z}/${EAST.x}/${EAST.y}.png`) {
            res.writeHead(200, { 'content-type': 'image/png' });
            return res.end(tile);
        }

        if (url.pathname === '/dem/12/1/1.png') {
            res.writeHead(200, { 'content-type': 'image/png' });
            return res.end('not a tile');
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

test('TileJSON: defaults', async () => {
    const res = await get('/tiles/hillshade/42');
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.name, 'Terrain');
    assert.equal(body.type, 'raster');
    assert.equal(body.format, 'png');
    assert.equal(body.encoding, undefined);
    assert.equal(body.legend, undefined);
    assert.equal(body.minzoom, 4);
    assert.equal(body.maxzoom, 16, 'DEM maxzoom plus overzoom');
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/hillshade/42/tiles/{z}/{x}/{y}?token=${token}`]);
});

test('TileJSON: supplied options are normalised onto the tile URL', async () => {
    const res = await fetch(`${baseURL()}/tiles/hillshade/42?shadow=%23000000ff&method=igor&azimuth=135.0`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).tiles, [`${process.env.PMTILES_URL}/tiles/hillshade/42/tiles/{z}/{x}/{y}?azimuth=135&method=igor&shadow=000000`]);
});

test('tile: an interior overzoomed tile needs one DEM fetch', async () => {
    requestedURLs.length = 0;

    const res = await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('cache-control'), 'private, max-age=86400');
    assert.match(res.headers.get('etag') || '', /^"[0-9a-f]{64}"$/);
    assert.deepEqual(requestedURLs, [demURL(DEM)]);

    const [r, g, b, a] = await pixel(await res.arrayBuffer(), CENTRE, CENTRE);
    assert.deepEqual([r, g, b], [255, 255, 255], 'a west-facing slope is lit from the north-west');
    assert.ok(a > 100 && a < 180, `highlight alpha ${a}`);
});

test('tile: lighting options change the rendering', async () => {
    const shadowed = await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}?azimuth=135`);
    assert.equal(shadowed.status, 200);

    const [r, g, b, a] = await pixel(await shadowed.arrayBuffer(), CENTRE, CENTRE);
    assert.deepEqual([r, g, b], [0, 0, 0], 'lit from the south-east the same slope falls in shadow');
    assert.ok(a > 0, `shadow alpha ${a}`);

    const tinted = await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}?azimuth=135&shadow=0000ff`);
    assert.equal(tinted.status, 200);
    assert.deepEqual((await pixel(await tinted.arrayBuffer(), CENTRE, CENTRE)).slice(0, 3), [0, 0, 255]);
});

test('tile: a native zoom tile reads its eight neighbours once', async () => {
    requestedURLs.length = 0;

    const res = await get(`/tiles/hillshade/42/tiles/${DEM.z}/${DEM.x}/${DEM.y}`);
    assert.equal(res.status, 200);
    assert.deepEqual([...requestedURLs].sort(), neighbourhood(DEM).filter(url => url !== demURL(DEM)), 'the centre was cached by the overzoomed tile');

    requestedURLs.length = 0;

    const next = await get(`/tiles/hillshade/42/tiles/${EAST.z}/${EAST.x}/${EAST.y}`);
    assert.equal(next.status, 200);

    const fresh = [-1, 0, 1].map(dy => demURL(DEM.neighbor(2, dy)!)).sort();
    assert.deepEqual([...requestedURLs].sort(), fresh, 'only the column the first tile did not touch is fetched');
});

test('tile: cache entries are keyed by basemap and options', async () => {
    requestedURLs.length = 0;

    const res = await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}`);
    assert.equal(res.status, 200);
    assert.deepEqual(requestedURLs, [], 'served from cache');

    const keys = await fs.readdir(path.join(process.env.TILE_CACHE_DIR!, 'hillshade'));
    assert.equal(keys.length, 3, 'default options plus two lighting variants');
});

test('tile: 204 where the DEM has no tile', async () => {
    assert.equal((await get('/tiles/hillshade/42/tiles/12/0/0')).status, 204);
});

test('tile: 400 when the DEM tile is not an image', async () => {
    const res = await get('/tiles/hillshade/42/tiles/12/1/1');

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'DEM tile is not a supported raster image');
});

test('tile: 404 outside the shaded zoom range', async () => {
    assert.equal((await get('/tiles/hillshade/42/tiles/3/0/0')).status, 404);
    assert.equal((await get('/tiles/hillshade/42/tiles/17/0/0')).status, 404);
});

test('both routes reject malformed options', async () => {
    const method = await get('/tiles/hillshade/42?method=fancy');
    assert.equal(method.status, 400);
    assert.equal((await method.json()).message, 'Invalid hillshade method "fancy": expected one of standard, combined, igor, multidirectional');

    const azimuth = await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}?azimuth=400`);
    assert.equal(azimuth.status, 400);
    assert.equal((await azimuth.json()).message, 'Invalid hillshade azimuth "400": expected 0 <= azimuth <= 360');

    const repeated = await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}?altitude=10&altitude=20`);
    assert.equal(repeated.status, 400);
    assert.equal((await repeated.json()).message, 'Invalid hillshade altitude: expected a single value');
});

test('both routes reject basemaps that are not raster-dem', async () => {
    const tilejson = await get('/tiles/hillshade/43');
    assert.equal(tilejson.status, 400);
    assert.equal((await tilejson.json()).message, 'Hillshade shading requires a raster-dem basemap');

    const tile = await get('/tiles/hillshade/43/tiles/12/2048/1024');
    assert.equal(tile.status, 400);
    assert.equal((await tile.json()).message, 'Hillshade shading requires a raster-dem basemap');
});

test('both routes require auth', async () => {
    assert.equal((await get('/tiles/hillshade/42', null)).status, 401);
    assert.equal((await get(`/tiles/hillshade/42/tiles/${OVERZOOMED}`, null)).status, 401);
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
