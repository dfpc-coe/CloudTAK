import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'net';
import { solid, pixel, near } from './lib/raster.js';
import { encodeSpec } from '../lib/composite.js';

process.env.StackName = 'test';
process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

let app: any;
let server: http.Server;
let api: http.Server;
let Basemap: typeof import('../lib/basemap.js').default;

const apiRequests: string[] = [];
const tileRequests: string[] = [];

const userToken = jwt.sign({ email: 'owner@example.com', access: 'user' }, 'test-secret');
const compositeSharingToken = 'etl.' + jwt.sign({ id: 50, access: 'basemap', internal: true }, 'test-secret');
const redSharingToken = 'etl.' + jwt.sign({ id: 51, access: 'basemap', internal: true }, 'test-secret');

const base = {
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    parent: null,
    format: 'png',
    type: 'raster',
    username: null,
    sharing_enabled: false,
    sharing_token: null,
    hidden: false,
    tilesize: 256,
    attribution: null,
    collection: null,
    frequency: null,
    scheme: 'xyz',
    overlay: false,
    actions: { feature: [] },
};

// Red covers lon -110..-102 lat 37..41; Blue is 512px and covers lon -120..-100 lat 30..45
const basemaps: Record<number, Record<string, unknown>> = {};

// z5/6/12 lies inside both; z6/11/25 lies inside Blue only; z14/3367/6261 is inside both and past Red's maxzoom
const BOTH = '5/6/12';
const BLUE_ONLY = '6/11/25';
const DEEP = '14/3367/6261';

function baseURL(): string {
    return `http://localhost:${(server.address() as AddressInfo).port}`;
}

function get(route: string, token: string | null = userToken): Promise<Response> {
    return fetch(`${baseURL()}${route}${token ? `${route.includes('?') ? '&' : '?'}token=${token}` : ''}`);
}

test('Setup', async () => {
    process.env.TILE_CACHE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'pmtiles-composite-'));

    const red = await solid(255, 0, 0);
    const blue = await solid(0, 0, 255, 1, 512);

    api = http.createServer((req, res) => {
        const url = new URL(String(req.url), 'http://127.0.0.1');

        // Upstream tile hosts
        if (url.pathname.startsWith('/red/') || url.pathname.startsWith('/blue/')) {
            tileRequests.push(url.pathname);
            res.writeHead(200, { 'content-type': 'image/png' });
            return res.end(url.pathname.startsWith('/red/') ? red : blue);
        }

        if (url.pathname.startsWith('/empty/')) {
            tileRequests.push(url.pathname);
            res.writeHead(204);
            return res.end();
        }

        // CloudTAK API: sharing tokens only see their own basemap and never get children
        apiRequests.push(String(req.url));
        const token = url.searchParams.get('token') || '';
        const match = url.pathname.match(/^\/api\/basemap\/(\d+)$/);
        const id = match ? Number(match[1]) : NaN;

        if (token.startsWith('etl.')) {
            const decoded = jwt.verify(token.replace(/^etl\./, ''), 'test-secret') as { id: number };
            if (decoded.id !== id) {
                res.writeHead(400, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({ status: 400, message: 'You don\'t have permission to access this resource' }));
            }
        } else {
            try {
                jwt.verify(token, 'test-secret');
            } catch {
                res.writeHead(401, { 'content-type': 'application/json' });
                return res.end(JSON.stringify({ status: 401, message: 'Invalid Token' }));
            }
        }

        const basemap = basemaps[id];
        if (req.method === 'GET' && basemap) {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({
                ...basemap,
                children: token.startsWith('etl.') ? [] : basemap.children,
            }));
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 404, message: 'Item Not Found' }));
    });

    await new Promise<void>((resolve) => {
        api.listen(0, '127.0.0.1', () => resolve());
    });

    process.env.API_URL = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
    process.env.PMTILES_URL = process.env.API_URL;

    basemaps[51] = {
        ...base,
        id: 51,
        name: 'Red',
        url: `${process.env.API_URL}/red/{z}/{x}/{y}.png`,
        protocol: 'zxy',
        minzoom: 0,
        maxzoom: 12,
        attribution: 'Red Co',
        bounds: [-110, 37, -102, 41],
        sharing_enabled: true,
        sharing_token: redSharingToken,
    };

    basemaps[52] = {
        ...base,
        id: 52,
        name: 'Blue',
        url: `${process.env.API_URL}/blue/{z}/{x}/{y}.png`,
        protocol: 'zxy',
        tilesize: 512,
        minzoom: 2,
        maxzoom: 16,
        attribution: 'Blue Co',
        bounds: [-120, 30, -100, 45],
    };

    basemaps[53] = {
        ...base,
        id: 53,
        name: 'USA Cities',
        url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer/0',
        protocol: 'mapserver',
        type: 'vector',
        format: 'mvt',
        minzoom: 0,
        maxzoom: 16,
    };

    basemaps[55] = {
        ...base,
        id: 55,
        name: 'Empty',
        url: `${process.env.API_URL}/empty/{z}/{x}/{y}.png`,
        protocol: 'zxy',
        minzoom: 0,
        maxzoom: 16,
    };

    basemaps[50] = {
        ...base,
        id: 50,
        name: 'Red over Blue',
        url: '',
        protocol: 'composite',
        minzoom: 0,
        maxzoom: 16,
        bounds: [-120, 30, -100, 45],
        sharing_enabled: true,
        sharing_token: compositeSharingToken,
        layers: [
            { basemap: 51 },
            { basemap: 52, opacity: 0.5 },
        ],
        children: [basemaps[51], basemaps[52]],
    };

    basemaps[56] = {
        ...base,
        id: 56,
        name: 'Vector Format Composite',
        url: '',
        protocol: 'composite',
        format: 'mvt',
        minzoom: 0,
        maxzoom: 16,
        layers: [{ basemap: 51 }],
        children: [basemaps[51]],
    };

    basemaps[57] = {
        ...base,
        id: 57,
        name: 'Empty Composite',
        url: '',
        protocol: 'composite',
        minzoom: 0,
        maxzoom: 16,
        layers: [],
        children: [],
    };

    const mod = await import('../index.js');
    app = mod.app;

    ({ default: Basemap } = await import('../lib/basemap.js'));

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
    });
});

test('stored composite: TileJSON comes from the parent row', async () => {
    const res = await get('/tiles/basemap/50/tiles');

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.type, 'raster');
    assert.equal(body.tileSize, 256);
    assert.deepEqual(body.bounds, [-120, 30, -100, 45]);
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/basemap/50/tiles/{z}/{x}/{y}?token=${userToken}`]);
});

test('stored composite: tile blends the children in layer order', async () => {
    tileRequests.length = 0;

    const res = await get(`/tiles/basemap/50/tiles/${BOTH}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('cache-control'), 'private, max-age=86400');
    assert.match(res.headers.get('etag') || '', /^"[0-9a-f]{64}"$/);

    near(await pixel(await res.arrayBuffer()), [128, 0, 128, 255]);
    assert.deepEqual(tileRequests.sort(), [`/blue/${BOTH}.png`, `/red/${BOTH}.png`]);
});

test('stored composite: repeat requests are served from the cache', async () => {
    tileRequests.length = 0;

    const res = await get(`/tiles/basemap/50/tiles/${BOTH}`);

    assert.equal(res.status, 200);
    near(await pixel(await res.arrayBuffer()), [128, 0, 128, 255]);
    assert.deepEqual(tileRequests, []);

    const cached = await fs.readdir(path.join(process.env.TILE_CACHE_DIR!, 'composite'));
    assert.equal(cached.length, 1);
});

test('stored composite: a child outside its bounds is skipped', async () => {
    tileRequests.length = 0;

    const res = await get(`/tiles/basemap/50/tiles/${BLUE_ONLY}`);

    assert.equal(res.status, 200);
    near(await pixel(await res.arrayBuffer()), [0, 0, 255, 128]);
    assert.deepEqual(tileRequests, [`/blue/${BLUE_ONLY}.png`]);
});

test('stored composite: a child past its maxzoom is overzoomed from its parent tile', async () => {
    tileRequests.length = 0;

    const res = await get(`/tiles/basemap/50/tiles/${DEEP}`);

    assert.equal(res.status, 200);
    near(await pixel(await res.arrayBuffer()), [128, 0, 128, 255]);
    assert.deepEqual(tileRequests.sort(), [`/blue/${DEEP}.png`, '/red/12/841/1565.png']);
});

test('stored composite: children are looked up when the API omits them', async () => {
    Basemap.clearCache();
    apiRequests.length = 0;

    const res = await get(`/tiles/basemap/50/tiles/${BOTH}`, compositeSharingToken);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'You don\'t have permission to access this resource');
    assert.deepEqual(apiRequests.sort(), [50, 51, 52].map(id => `/api/basemap/${id}?token=${compositeSharingToken}`));
});

test('stored composite: a vector output format is rejected', async () => {
    const res = await get(`/tiles/basemap/56/tiles/${BOTH}`);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'Composite basemaps must use a raster format');
});

test('stored composite: no layers is rejected', async () => {
    const res = await get(`/tiles/basemap/57/tiles/${BOTH}`);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'Composite basemap has no layers');
});

test('ad hoc composite: TileJSON is derived from the layers', async () => {
    const spec = encodeSpec({ format: 'webp', layers: [{ basemap: 51 }, { basemap: 52, blend: 'multiply' }] });

    const res = await get(`/tiles/composite/${spec}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.type, 'raster');
    assert.equal(body.format, 'webp');
    assert.equal(body.tileSize, 256);
    assert.equal(body.minzoom, 0);
    assert.equal(body.maxzoom, 16);
    assert.equal(body.attribution, 'Red Co, Blue Co');
    assert.deepEqual(body.bounds, [-120, 30, -100, 45]);
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/composite/${spec}/tiles/{z}/{x}/{y}?token=${userToken}`]);
});

test('ad hoc composite: bearer auth yields token-free tile URLs and world bounds when a child has none', async () => {
    const spec = encodeSpec({ layers: [{ basemap: 55 }] });

    const res = await fetch(`${baseURL()}/tiles/composite/${spec}`, {
        headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/composite/${spec}/tiles/{z}/{x}/{y}`]);
    assert.deepEqual(body.bounds, [-180, -90, 180, 90]);
    assert.equal(body.attribution, undefined);
});

test('ad hoc composite: tile renders with the requested format', async () => {
    const spec = encodeSpec({ format: 'webp', layers: [{ basemap: 51 }, { basemap: 52, blend: 'multiply' }] });

    const res = await get(`/tiles/composite/${spec}/tiles/${BOTH}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/webp');
    near(await pixel(await res.arrayBuffer()), [0, 0, 0], 4);
});

test('ad hoc composite: 204 when no layer has data', async () => {
    const res = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 55 }] })}/tiles/${BOTH}`);

    assert.equal(res.status, 204);
});

test('ad hoc composite: invalid specs are a 400', async () => {
    const empty = await get(`/tiles/composite/${encodeSpec({ layers: [] })}`);
    assert.equal(empty.status, 400);
    assert.match((await empty.json()).message, /^Invalid composite/);

    const garbage = await get('/tiles/composite/not-json');
    assert.equal(garbage.status, 400);
});

test('ad hoc composite: vector and composite children are rejected', async () => {
    const vector = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 53 }] })}`);
    assert.equal(vector.status, 400);
    assert.equal((await vector.json()).message, 'Basemap 53 is vector - composite layers must be raster');

    const nested = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 50 }] })}`);
    assert.equal(nested.status, 400);
    assert.equal((await nested.json()).message, 'Basemap 50 is a composite and cannot be nested');
});

test('ad hoc composite: a missing child passes the API error through', async () => {
    const res = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 99 }] })}`);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).message, 'Item Not Found');
});

test('ad hoc composite: auth is required', async () => {
    const res = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 51 }] })}`, null);

    assert.equal(res.status, 401);
});

test('ad hoc composite: a sharing token only reaches its own basemap', async () => {
    Basemap.clearCache();

    const own = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 51 }] })}`, redSharingToken);
    assert.equal(own.status, 200);

    const mixed = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 51 }, { basemap: 52 }] })}`, redSharingToken);
    assert.equal(mixed.status, 400);
    assert.equal((await mixed.json()).message, 'You don\'t have permission to access this resource');

    const other = await get(`/tiles/composite/${encodeSpec({ layers: [{ basemap: 52 }] })}`, redSharingToken);
    assert.equal(other.status, 403);
});

test('Teardown', async () => {
    await fs.rm(process.env.TILE_CACHE_DIR!, { recursive: true, force: true });

    server.closeAllConnections();
    api.closeAllConnections();
    await Promise.all([server, api].map(s => new Promise<void>((resolve) => {
        s.close(() => resolve());
    })));

    process.exit(0);
});
