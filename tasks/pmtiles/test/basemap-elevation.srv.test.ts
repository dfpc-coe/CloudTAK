import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';
import { PNG } from 'pngjs';

process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';
process.env.API_URL = 'http://localhost:5001';

let app: any;
let server: http.Server;

function createTile(elevation: number): ArrayBuffer {
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

    const bytes = new Uint8Array(PNG.sync.write(png));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test('Setup', async () => {
    const mod = await import('../index.js');

    app = mod.app;

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
    });
});

test('POST /tiles/basemap/:basemapid/elevation returns sampled elevations', async () => {
    const token = jwt.sign({ email: 'user@example.com', access: 'user' }, process.env.SigningSecret!);
    const originalFetch = globalThis.fetch;
    const requestedURLs = new Set<string>();
    const leftTile = createTile(100);
    const rightTile = createTile(200);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requestedURLs.add(url);

        if (url === `http://localhost:5001/api/basemap/42?token=${token}`) {
            return Response.json({
                id: 42,
                type: 'raster-dem',
                minzoom: 0,
                maxzoom: 2,
                encoding: 'mapbox'
            });
        }

        if (url === `http://localhost:5001/api/basemap/42/tiles?token=${token}`) {
            return Response.json({
                type: 'raster-dem',
                format: 'png',
                minzoom: 0,
                maxzoom: 2,
                tiles: ['https://example.test/terrain/{z}/{x}/{y}.png?token=' + token]
            });
        }

        if (url === `https://example.test/terrain/2/1/1.png?token=${token}`) {
            return new Response(leftTile, {
                status: 200,
                headers: { 'Content-Type': 'image/png' }
            });
        }

        if (url === `https://example.test/terrain/2/2/1.png?token=${token}`) {
            return new Response(rightTile, {
                status: 200,
                headers: { 'Content-Type': 'image/png' }
            });
        }

        return originalFetch(input, init);
    };

    try {
        const addr = server.address() as AddressInfo;
        const res = await originalFetch(`http://localhost:${addr.port}/tiles/basemap/42/elevation?token=${token}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [-10, 1],
                        [10, 1]
                    ]
                },
                sampleRate: 500,
                zoom: 2,
            })
        });

        assert.equal(res.status, 200);

        const body = await res.json();
        assert.equal(body.zoom, 2);
        assert.equal(body.tileCount, 2);
        assert.equal(body.samples[0].elevation, 100);
        assert.equal(body.samples.at(-1).elevation, 200);
        assert.ok(requestedURLs.has(`http://localhost:5001/api/basemap/42?token=${token}`));
        assert.ok(requestedURLs.has(`http://localhost:5001/api/basemap/42/tiles?token=${token}`));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Teardown', async () => {
    if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    process.exit(0);
});