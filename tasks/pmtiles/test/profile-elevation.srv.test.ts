import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';
import { demTile } from './lib/dem.js';

process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

let app: any;
let server: http.Server;
let FileTiles: any;

test('Setup', async () => {
    const mod = await import('../index.js');
    const tiles = await import('../lib/tiles.js');

    app = mod.app;
    FileTiles = tiles.FileTiles;

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
    });
});

test('POST /tiles/profile/:username/:file/elevation returns sampled elevations', async () => {
    const token = jwt.sign({ email: 'user@example.com', access: 'profile' }, process.env.SigningSecret!);
    const originalFetch = globalThis.fetch;
    const originalRasterTileSource = FileTiles.prototype.rasterTileSource;
    const leftTile = await demTile(100);
    const rightTile = await demTile(200);

    FileTiles.prototype.rasterTileSource = async function (this: unknown, requestToken: string) {
        assert.equal(requestToken, token);

        return {
            format: 'png',
            tileurl: 'https://example.test/terrain/{z}/{x}/{y}.png',
            minzoom: 0,
            maxzoom: 2,
        };
    };

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === 'https://example.test/terrain/2/1/1.png') {
            return new Response(leftTile, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            });
        }

        if (url === 'https://example.test/terrain/2/2/1.png') {
            return new Response(rightTile, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            });
        }

        return originalFetch(input, init);
    };

    try {
        const addr = server.address() as AddressInfo;
        const res = await originalFetch(`http://localhost:${addr.port}/tiles/profile/user@example.com/dem/elevation?token=${token}`, {
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
    } finally {
        globalThis.fetch = originalFetch;
        FileTiles.prototype.rasterTileSource = originalRasterTileSource;
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
