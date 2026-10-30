import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';
import { PNG } from 'pngjs';

process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

let app: any;
let server: http.Server;
let upstream: http.Server;

const requestedURLs = new Set<string>();
const token = jwt.sign({ email: 'user@example.com', access: 'user' }, process.env.SigningSecret!);

function createTile(elevation: number): Buffer {
    const png = new PNG({ width: 4, height: 4 });
    const value = Math.round((elevation + 10000) * 10);
    const r = (value >> 16) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = value & 0xff;

    for (let index = 0; index < png.data.length; index += 4) {
        png.data[index] = r;
        png.data[index + 1] = g;
        png.data[index + 2] = b;
        png.data[index + 3] = 0xff;
    }

    return PNG.sync.write(png);
}

test('Setup', async () => {
    const leftTile = createTile(100);
    const rightTile = createTile(200);

    // Plays both the CloudTAK API (basemap config) and this tile server's own tile route
    upstream = http.createServer((req, res) => {
        const url = new URL(String(req.url), 'http://127.0.0.1');
        requestedURLs.add(`${url.pathname}?${url.searchParams}`);

        if (url.pathname === '/api/basemap/42') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                id: 42,
                name: 'Terrain',
                url: 'https://terrain.example.test/{z}/{x}/{y}.png',
                protocol: 'zxy',
                type: 'raster-dem',
                format: 'png',
                encoding: 'mapbox',
                minzoom: 0,
                maxzoom: 2,
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

        const tile = url.pathname === '/tiles/basemap/42/tiles/2/1/1'
            ? leftTile
            : url.pathname === '/tiles/basemap/42/tiles/2/2/1' ? rightTile : undefined;

        if (tile) {
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

test('POST /tiles/basemap/:basemapid/elevation returns sampled elevations', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/basemap/42/elevation?token=${token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-10, 1],
                    [10, 1],
                ],
            },
            samples: 10,
            zoom: 2,
        }),
    });

    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.zoom, 2);
    assert.equal(body.tileCount, 2);
    assert.equal(body.samples[0].elevation, 100);
    assert.equal(body.samples.at(-1).elevation, 200);
    assert.ok(requestedURLs.has(`/api/basemap/42?token=${token}`));
    assert.ok(requestedURLs.has(`/tiles/basemap/42/tiles/2/1/1?token=${token}`));
    assert.ok(requestedURLs.has(`/tiles/basemap/42/tiles/2/2/1?token=${token}`));
});

test('POST /tiles/basemap/:basemapid/elevation rejects zoom above the layer maximum', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/basemap/42/elevation?token=${token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-10, 1],
                    [10, 1],
                ],
            },
            samples: 10,
            zoom: 5,
        }),
    });

    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'Above Layer MaxZoom');
});

test('POST /tiles/basemap/:basemapid/elevation without auth returns 401', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/basemap/42/elevation`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-10, 1],
                    [10, 1],
                ],
            },
            samples: 10,
        }),
    });

    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'No Auth Present');
});

test('Teardown', async () => {
    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([server, upstream].map(s => new Promise<void>((resolve) => {
        s.close(() => resolve());
    })));

    process.exit(0);
});
