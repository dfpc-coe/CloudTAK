import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';

process.env.StackName = 'test';
process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

let app: any;
let server: http.Server;
let api: http.Server;
let Basemap: typeof import('../lib/basemap.js').default;

const apiRequests: string[] = [];

const sharingToken = 'etl.' + jwt.sign({ id: 42, access: 'basemap', internal: true, t: 1 }, 'test-secret');
const userToken = jwt.sign({ email: 'owner@example.com', access: 'user' }, 'test-secret');

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
    children: [],
};

const basemaps: Record<number, Record<string, unknown>> = {
    42: {
        ...base,
        id: 42,
        name: 'Test Basemap',
        url: 'https://tiles.example.test/{z}/{x}/{y}.png',
        protocol: 'zxy',
        minzoom: 2,
        maxzoom: 14,
        username: 'owner@example.com',
        sharing_enabled: true,
        sharing_token: sharingToken,
        attribution: 'Unit Test',
        bounds: [-110, 37, -102, 41],
    },
    44: {
        ...base,
        id: 44,
        name: 'NSW Topo',
        url: 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Topo_Map/MapServer/WMTS/tile/1.0.0/public_NSW_Topo_Map/default/GoogleMapsCompatible/{z}/{y}/{x}',
        protocol: 'zxy',
        minzoom: 0,
        maxzoom: 18,
    },
    46: {
        ...base,
        id: 46,
        name: 'USA Cities',
        url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer/0',
        protocol: 'mapserver',
        type: 'vector',
        format: 'mvt',
        minzoom: 0,
        maxzoom: 16,
        actions: { feature: ['fetch', 'query'] },
    },
};

function baseURL(): string {
    return `http://localhost:${(server.address() as AddressInfo).port}`;
}

test('Setup', async () => {
    api = http.createServer((req, res) => {
        apiRequests.push(String(req.url));

        const url = new URL(String(req.url), 'http://127.0.0.1');
        const token = url.searchParams.get('token') || '';

        if (url.pathname.startsWith('/oversized/')) {
            res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(10 * 1024 * 1024) });
            res.end();
            return;
        }

        if (url.pathname.startsWith('/oversized-chunked/')) {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.write(Buffer.alloc(3 * 1024 * 1024));
            res.write(Buffer.alloc(3 * 1024 * 1024));
            res.end();
            return;
        }

        if (url.pathname === '/tiles/public/hosted-set') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                tilejson: '3.0.0',
                name: 'hosted-set.pmtiles',
                description: 'Hosted by CloudTAK',
                version: '1.0.0',
                scheme: 'xyz',
                tiles: [`${process.env.PMTILES_URL}/tiles/public/hosted-set/tiles/{z}/{x}/{y}.png?token=${token}`],
                minzoom: 3,
                maxzoom: 9,
                bounds: [-10, -5, 10, 5],
                center: [0, 0, 6],
                type: 'raster',
            }));
            return;
        }

        if (token.startsWith('etl.')) {
            if (token !== sharingToken) {
                res.writeHead(400, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ status: 400, message: 'You don\'t have permission to access this resource' }));
                return;
            }
        } else {
            try {
                jwt.verify(token, 'test-secret');
            } catch {
                res.writeHead(401, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ status: 401, message: 'Invalid Token' }));
                return;
            }
        }

        const match = url.pathname.match(/^\/api\/basemap\/(\d+)$/);
        const basemap = match ? basemaps[Number(match[1])] : undefined;

        if (req.method === 'GET' && basemap) {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(basemap));
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 404, message: 'Item Not Found' }));
    });

    await new Promise<void>((resolve) => {
        api.listen(0, '127.0.0.1', () => resolve());
    });

    process.env.API_URL = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
    process.env.PMTILES_URL = process.env.API_URL;

    basemaps[47] = {
        ...base,
        id: 47,
        name: 'Oversized',
        url: `${process.env.API_URL}/oversized/{z}/{x}/{y}.png`,
        protocol: 'zxy',
        minzoom: 0,
        maxzoom: 16,
    };

    basemaps[48] = {
        ...base,
        id: 48,
        name: 'Oversized Chunked',
        url: `${process.env.API_URL}/oversized-chunked/{z}/{x}/{y}.png`,
        protocol: 'zxy',
        minzoom: 0,
        maxzoom: 16,
    };

    basemaps[45] = {
        ...base,
        id: 45,
        name: 'Hosted Set',
        url: `${process.env.PMTILES_URL}/tiles/public/hosted-set/tiles/{z}/{x}/{y}.png`,
        tilejson: `${process.env.PMTILES_URL}/tiles/public/hosted-set`,
        protocol: 'hosted',
        minzoom: 0,
        maxzoom: 16,
    };

    const mod = await import('../index.js');
    app = mod.app;

    ({ default: Basemap } = await import('../lib/basemap.js'));

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
    });
});

test('GET /tiles/basemap/:basemapid/tiles returns TileJSON for the owner', async () => {
    Basemap.clearCache();
    apiRequests.length = 0;

    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${userToken}`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
        tilejson: '3.0.0',
        version: '1.0.0',
        scheme: 'xyz',
        name: 'Test Basemap',
        description: '',
        attribution: 'Unit Test',
        tileSize: 256,
        minzoom: 2,
        maxzoom: 14,
        tiles: [`${process.env.PMTILES_URL}/tiles/basemap/42/tiles/{z}/{x}/{y}?token=${userToken}`],
        bounds: [-110, 37, -102, 41],
        center: [-106, 39, 8],
        type: 'raster',
        actions: { feature: [] },
    });

    assert.deepEqual(apiRequests, [`/api/basemap/42?token=${userToken}`]);
});

test('GET /tiles/basemap/:basemapid/tiles serves config from cache on repeat requests', async () => {
    apiRequests.length = 0;

    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${userToken}`);

    assert.equal(res.status, 200);
    assert.deepEqual(apiRequests, []);
});

test('GET /tiles/basemap/:basemapid/tiles accepts a bearer header and returns token-free tile URLs', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles`, {
        headers: { Authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/basemap/42/tiles/{z}/{x}/{y}`]);
});

test('GET /tiles/basemap/:basemapid/tiles without auth returns 401', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles`);

    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'No Auth Present');
});

test('GET /tiles/basemap/:basemapid/tiles rejects a non-bearer authorization header', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles`, {
        headers: { Authorization: `Basic ${userToken}` },
    });

    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'Only "Bearer" authorization header is allowed');
});

test('GET /tiles/basemap/:basemapid/tiles rejects other users for a user-scoped basemap', async () => {
    const token = jwt.sign({ email: 'other@example.com', access: 'user' }, 'test-secret');
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${token}`);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'You don\'t have permission to access this resource');
});

test('GET /tiles/basemap/:basemapid/tiles allows admins for a user-scoped basemap', async () => {
    const token = jwt.sign({ email: 'admin@example.com', access: 'admin' }, 'test-secret');
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${token}`);

    assert.equal(res.status, 200);
});

test('GET /tiles/basemap/:basemapid/tiles accepts the matching sharing token', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${sharingToken}`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.tiles[0], `${process.env.PMTILES_URL}/tiles/basemap/42/tiles/{z}/{x}/{y}?token=${sharingToken}`);
});

test('GET /tiles/basemap/:basemapid/tiles fetches config with the sharing token on a cold cache', async () => {
    Basemap.clearCache();
    apiRequests.length = 0;

    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${sharingToken}`);

    assert.equal(res.status, 200);
    assert.deepEqual(apiRequests, [`/api/basemap/42?token=${sharingToken}`]);
});

test('GET /tiles/basemap/:basemapid/tiles passes through API rejection of a stale sharing token on a cold cache', async () => {
    Basemap.clearCache();

    const stale = 'etl.' + jwt.sign({ id: 42, access: 'basemap', internal: true, t: 3 }, 'test-secret');
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${stale}`);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'You don\'t have permission to access this resource');
});

test('GET /tiles/basemap/:basemapid/tiles rejects a stale sharing token', async () => {
    await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${userToken}`);

    const stale = 'etl.' + jwt.sign({ id: 42, access: 'basemap', internal: true, t: 2 }, 'test-secret');
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${stale}`);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'You don\'t have permission to access this resource');
});

test('GET /tiles/basemap/:basemapid/tiles rejects a sharing token for another basemap', async () => {
    const other = 'etl.' + jwt.sign({ id: 7, access: 'basemap', internal: true, t: 1 }, 'test-secret');
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${other}`);

    assert.equal(res.status, 403);
    assert.equal((await res.json()).message, 'Resource token cannot access this resource');
});

test('GET /tiles/basemap/:basemapid/tiles rejects a non-basemap resource token', async () => {
    const layer = 'etl.' + jwt.sign({ id: 42, access: 'layer' }, 'test-secret');
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=${layer}`);

    assert.equal(res.status, 403);
    assert.equal((await res.json()).message, 'Resource token cannot access this resource');
});

test('GET /tiles/basemap/:basemapid/tiles rejects an invalid token', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles?token=garbage`);

    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'Invalid Token');
});

test('GET /tiles/basemap/:basemapid/tiles resolves hosted basemaps through their upstream TileJSON', async () => {
    apiRequests.length = 0;

    const res = await fetch(`${baseURL()}/tiles/basemap/45/tiles?token=${userToken}`);

    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.name, 'hosted-set.pmtiles');
    assert.equal(body.minzoom, 3);
    assert.equal(body.maxzoom, 9);
    assert.equal(body.type, 'raster');
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/public/hosted-set/tiles/{z}/{x}/{y}.png?token=${userToken}`]);
    assert.deepEqual(body.actions, { feature: [] });

    assert.deepEqual(apiRequests, [
        `/api/basemap/45?token=${userToken}`,
        `/tiles/public/hosted-set?token=${userToken}`,
    ]);
});

test('GET /tiles/basemap/:basemapid/tiles/:z/:x/:y short-circuits tiles outside the basemap bounds', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles/4/0/0?token=${userToken}`);

    assert.equal(res.status, 404);
    assert.equal(await res.text(), 'Tile outside bounds');
});

test('GET /tiles/basemap/:basemapid/tiles/:z/:x/:y reports upstream failures as 400', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/42/tiles/8/52/98?token=${userToken}`);

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'Failed to fetch tile');
});

test('GET /tiles/basemap/:basemapid/tiles/:z/:x/:y rejects tiles over the Lambda response limit by content-length', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/47/tiles/1/0/0?token=${userToken}`);

    assert.equal(res.status, 413);
    assert.match((await res.json()).message, /response limit/);
});

test('GET /tiles/basemap/:basemapid/tiles/:z/:x/:y truncates chunked tiles over the Lambda response limit', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/48/tiles/1/0/0?token=${userToken}`);

    assert.equal(res.status, 200);
    const body = await res.arrayBuffer();
    assert.ok(body.byteLength <= Math.floor((6 * 1024 * 1024) * 3 / 4), `Body was ${body.byteLength} bytes`);
});

test('GET /tiles/basemap/:basemapid/tiles/:z/:x/:y proxies a zxy tile (live network)', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/44/tiles/5/29/19?token=${userToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.ok((await res.arrayBuffer()).byteLength > 1000);
});

test('GET /tiles/basemap/:basemapid/tiles merges ESRI metadata for MapServer layers (live network)', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/46/tiles?token=${userToken}`);

    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.type, 'vector');
    assert.ok(Array.isArray(body.vector_layers) && body.vector_layers.length > 0);
    assert.deepEqual(body.actions, { feature: ['fetch', 'query'] });
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/basemap/46/tiles/{z}/{x}/{y}?token=${userToken}`]);
});

test('GET /tiles/basemap/:basemapid/tiles/:z/:x/:y renders a MapServer vector tile (live network)', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/46/tiles/4/3/6?token=${userToken}`);

    assert.ok([200, 404].includes(res.status), `Unexpected status ${res.status}`);
    if (res.status === 200) {
        assert.equal(res.headers.get('content-type'), 'application/vnd.mapbox-vector-tile');
        assert.ok((await res.arrayBuffer()).byteLength > 0);
    }
});

test('GET /tiles/basemap/:basemapid/tiles passes through API errors', async () => {
    const res = await fetch(`${baseURL()}/tiles/basemap/43/tiles?token=${userToken}`);

    assert.equal(res.status, 404);
    assert.equal((await res.json()).message, 'Item Not Found');
});

test('Teardown', async () => {
    server.closeAllConnections();
    api.closeAllConnections();
    await Promise.all([server, api].map(s => new Promise<void>((resolve) => {
        s.close(() => resolve());
    })));

    process.exit(0);
});
