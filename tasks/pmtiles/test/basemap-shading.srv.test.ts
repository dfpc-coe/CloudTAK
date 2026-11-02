import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';
import { PNG } from 'pngjs';

process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

const SIZE = 64;
const DEM = { z: 12, x: 2048, y: 1024 };

let app: any;
let server: http.Server;
let upstream: http.Server;

const requestedURLs: string[] = [];
const token = jwt.sign({ email: 'user@example.com', access: 'user' }, process.env.SigningSecret!);

// Planar DEM rising eastward at 33 degrees, terrarium encoded
function demTile(): Buffer {
    const png = new PNG({ width: SIZE, height: SIZE });

    for (let py = 0; py < SIZE; py++) {
        const n = Math.PI - (2 * Math.PI * (DEM.y + (py + 0.5) / SIZE)) / 2 ** DEM.z;
        const cell = (40075016.686 * Math.cos(Math.atan(Math.sinh(n)))) / (2 ** DEM.z * SIZE);

        for (let px = 0; px < SIZE; px++) {
            const value = 1000 + px * cell * Math.tan(33 * Math.PI / 180) + 32768;
            const i = (py * SIZE + px) * 4;
            png.data[i] = Math.floor(value / 256);
            png.data[i + 1] = Math.floor(value % 256);
            png.data[i + 2] = Math.round((value % 1) * 256) & 0xff;
            png.data[i + 3] = 0xff;
        }
    }

    return PNG.sync.write(png);
}

test('Setup', async () => {
    const tile = demTile();

    // Plays both the CloudTAK API (basemap config) and this tile server's own tile route
    upstream = http.createServer((req, res) => {
        const url = new URL(String(req.url), 'http://127.0.0.1');
        requestedURLs.push(`${url.pathname}?${url.searchParams}`);

        if (url.pathname === '/api/basemap/42' || url.pathname === '/api/basemap/43') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                id: Number(url.pathname.split('/').pop()),
                name: 'Terrain',
                url: 'https://terrain.example.test/{z}/{x}/{y}.png',
                protocol: 'zxy',
                type: url.pathname.endsWith('42') ? 'raster-dem' : 'raster',
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
            }));
            return;
        }

        if (url.pathname === `/tiles/basemap/42/tiles/${DEM.z}/${DEM.x}/${DEM.y}`) {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.end(tile);
            return;
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

test('GET /tiles/basemap/:basemapid/shading/slope returns slope TileJSON', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/basemap/42/shading/slope?token=${token}`);

    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.name, 'Terrain');
    assert.equal(body.type, 'raster');
    assert.equal(body.format, 'png');
    assert.equal(body.encoding, undefined);
    assert.equal(body.minzoom, 4);
    assert.equal(body.maxzoom, 16);
    assert.deepEqual(body.tiles, [`${process.env.PMTILES_URL}/tiles/basemap/42/shading/slope/{z}/{x}/{y}?token=${token}`]);
    assert.equal(body.legend.length, 5);
});

test('GET /tiles/basemap/:basemapid/shading/slope/:z/:x/:y renders from the basemap tile route', async () => {
    requestedURLs.length = 0;

    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/basemap/42/shading/slope/14/8193/4098?token=${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.deepEqual(requestedURLs, [`/tiles/basemap/42/tiles/12/2048/1024?token=${token}`]);

    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    const i = ((SIZE / 2) * SIZE + SIZE / 2) * 4;
    assert.deepEqual([...png.data.subarray(i, i + 4)], [255, 152, 0, 200]);
});

test('GET /tiles/basemap/:basemapid/shading/slope/:z/:x/:y is empty where upstream has no tile', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/basemap/42/shading/slope/12/0/0?token=${token}`);

    assert.equal(res.status, 204);
});

test('Slope shading rejects basemaps that are not raster-dem', async () => {
    const addr = server.address() as AddressInfo;

    const tilejson = await fetch(`http://localhost:${addr.port}/tiles/basemap/43/shading/slope?token=${token}`);
    assert.equal(tilejson.status, 400);
    assert.match((await tilejson.json()).message, /raster-dem/);

    const tile = await fetch(`http://localhost:${addr.port}/tiles/basemap/43/shading/slope/12/2048/1024?token=${token}`);
    assert.equal(tile.status, 400);
});

test('Teardown', async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
        server.close(() => resolve());
    });

    upstream.closeAllConnections();
    await new Promise<void>((resolve) => {
        upstream.close(() => resolve());
    });

    process.exit(0);
});
