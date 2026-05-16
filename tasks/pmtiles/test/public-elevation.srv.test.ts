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
let FileTiles: any;

function createTile(elevation: number): Uint8Array {
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

    return new Uint8Array(PNG.sync.write(png));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

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

test('POST /tiles/public/:name/elevation returns sampled elevations', async () => {
    const token = jwt.sign({ email: 'user@example.com', access: 'public' }, process.env.SigningSecret!);
    const originalFetch = globalThis.fetch;
    const originalRasterTileSource = FileTiles.prototype.rasterTileSource;
    const leftTile = createTile(100);
    const rightTile = createTile(200);

    FileTiles.prototype.rasterTileSource = async function(this: unknown, requestToken: string) {
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
            return new Response(asArrayBuffer(leftTile), {
                status: 200,
                headers: { 'Content-Type': 'image/png' }
            });
        }

        if (url === 'https://example.test/terrain/2/2/1.png') {
            return new Response(asArrayBuffer(rightTile), {
                status: 200,
                headers: { 'Content-Type': 'image/png' }
            });
        }

        return originalFetch(input, init);
    };

    try {
        const addr = server.address() as AddressInfo;
        const res = await originalFetch(`http://localhost:${addr.port}/tiles/public/dem/elevation?token=${token}`, {
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
        assert.ok(body.samples.some((sample: { elevation: number }) => sample.elevation === 100));
        assert.ok(body.samples.some((sample: { elevation: number }) => sample.elevation === 200));
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
