import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';
import { PNG } from 'pngjs';

process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';
process.env.PMTILES_URL = 'http://tiles.example.test';

const SIZE = 64;
const DEM = { z: 12, x: 2048, y: 1024 };

let app: any;
let server: http.Server;
let FileTiles: any;
let originalArchive: any;

const token = jwt.sign({ email: 'user@example.com', access: 'public' }, process.env.SigningSecret!);
const requested: string[] = [];

// Planar DEM rising eastward at 33 degrees, mapbox encoded
function demTile(): ArrayBuffer {
    const png = new PNG({ width: SIZE, height: SIZE });

    for (let py = 0; py < SIZE; py++) {
        const n = Math.PI - (2 * Math.PI * (DEM.y + (py + 0.5) / SIZE)) / 2 ** DEM.z;
        const cell = (40075016.686 * Math.cos(Math.atan(Math.sinh(n)))) / (2 ** DEM.z * SIZE);

        for (let px = 0; px < SIZE; px++) {
            const value = Math.round((1000 + px * cell * Math.tan(33 * Math.PI / 180) + 10000) * 10);
            const i = (py * SIZE + px) * 4;
            png.data[i] = (value >> 16) & 0xff;
            png.data[i + 1] = (value >> 8) & 0xff;
            png.data[i + 2] = value & 0xff;
            png.data[i + 3] = 0xff;
        }
    }

    const bytes = new Uint8Array(PNG.sync.write(png));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fakeArchive(tileType: number) {
    return {
        getHeader: async () => ({
            tileType,
            minZoom: 4,
            maxZoom: 12,
            minLon: -180,
            minLat: -85,
            maxLon: 180,
            maxLat: 85,
            centerLon: 0,
            centerLat: 0,
            centerZoom: 8,
        }),
        getZxy: async (z: number, x: number, y: number) => {
            requested.push(`${z}/${x}/${y}`);
            return z === DEM.z && x === DEM.x && y === DEM.y ? { data: demTile() } : undefined;
        },
    };
}

async function centrePixel(res: Response): Promise<number[]> {
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    assert.equal(png.width, SIZE);
    const i = ((SIZE / 2) * SIZE + SIZE / 2) * 4;
    return [...png.data.subarray(i, i + 4)];
}

test('Setup', async () => {
    const mod = await import('../index.js');
    const tiles = await import('../lib/tiles.js');
    const pmtiles = await import('pmtiles');

    app = mod.app;
    FileTiles = tiles.FileTiles;
    originalArchive = FileTiles.prototype.archive;
    FileTiles.prototype.archive = () => fakeArchive(pmtiles.TileType.Png);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
    });
});

test('GET /tiles/public/:name/shading/slope returns slope TileJSON with a legend', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope?token=${token}&encoding=mapbox`);

    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.type, 'raster');
    assert.equal(body.format, 'png');
    assert.equal(body.minzoom, 4);
    assert.equal(body.maxzoom, 16);
    assert.deepEqual(body.tiles, [`http://tiles.example.test/tiles/public/dem/shading/slope/{z}/{x}/{y}.png?token=${token}&encoding=mapbox`]);
    assert.deepEqual(body.legend.map((entry: { label: string }) => entry.label), ['27-30°', '30-35°', '35-45°', '45-50°', '50°+']);
});

test('GET /tiles/public/:name/shading/slope requires an encoding', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope?token=${token}`);

    assert.equal(res.status, 400);
});

test('GET /tiles/public/:name/shading/slope/:z/:x/:y.png renders slope classes', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/12/2048/1024.png?token=${token}&encoding=mapbox`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('cache-control'), 'private, max-age=86400');
    assert.deepEqual(await centrePixel(res), [255, 152, 0, 200]);
});

test('GET /tiles/public/:name/shading/slope/:z/:x/:y.png upsamples a parent DEM tile', async () => {
    requested.length = 0;

    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/14/8193/4098.png?token=${token}&encoding=mapbox`);

    assert.equal(res.status, 200);
    assert.deepEqual(requested, ['12/2048/1024']);
    assert.deepEqual(await centrePixel(res), [255, 152, 0, 200]);
});

test('GET /tiles/public/:name/shading/slope/:z/:x/:y.png is empty where the DEM has no tile', async () => {
    const addr = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/12/0/0.png?token=${token}&encoding=mapbox`);

    assert.equal(res.status, 204);
});

test('GET /tiles/public/:name/shading/slope/:z/:x/:y.png rejects zooms and formats it cannot render', async () => {
    const addr = server.address() as AddressInfo;

    const above = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/17/0/0.png?token=${token}&encoding=mapbox`);
    assert.equal(above.status, 404);

    const below = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/3/0/0.png?token=${token}&encoding=mapbox`);
    assert.equal(below.status, 404);

    const jpg = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/12/2048/1024.jpg?token=${token}&encoding=mapbox`);
    assert.equal(jpg.status, 400);
});

test('Slope shading rejects vector archives', async () => {
    const pmtiles = await import('pmtiles');
    FileTiles.prototype.archive = () => fakeArchive(pmtiles.TileType.Mvt);

    const addr = server.address() as AddressInfo;

    const tilejson = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope?token=${token}&encoding=mapbox`);
    assert.equal(tilejson.status, 400);
    assert.match((await tilejson.json()).message, /raster-dem/);

    const tile = await fetch(`http://localhost:${addr.port}/tiles/public/dem/shading/slope/12/2048/1024.png?token=${token}&encoding=mapbox`);
    assert.equal(tile.status, 400);
});

test('Teardown', async () => {
    FileTiles.prototype.archive = originalArchive;

    if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    process.exit(0);
});
