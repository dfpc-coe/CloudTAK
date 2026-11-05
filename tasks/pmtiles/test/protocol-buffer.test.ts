import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import type { AddressInfo } from 'net';
import { solid } from './lib/raster.js';
import type { BasemapConfig } from '../lib/basemap.js';
import ZXYBasemap from '../lib/basemap/zxy.js';
import HostedBasemap from '../lib/basemap/hosted.js';
import MapServerBasemap from '../lib/basemap/mapserver.js';
import { FileTiles } from '../lib/tiles.js';

process.env.StackName = 'test';
process.env.PMTILES_URL = 'https://tiles.example.test';

let upstream: http.Server;
let upstreamURL: string;
const requests: Array<{ path: string; userAgent?: string }> = [];

function config(url: string, extra: Partial<BasemapConfig> = {}): BasemapConfig {
    return {
        id: 1,
        name: 'Test',
        url,
        protocol: 'zxy',
        type: 'raster',
        format: 'png',
        minzoom: 0,
        maxzoom: 16,
        tilesize: 256,
        ...extra,
    } as BasemapConfig;
}

test('Setup', async () => {
    const png = await solid(1, 2, 3);

    upstream = http.createServer((req, res) => {
        const url = new URL(String(req.url), 'http://127.0.0.1');
        requests.push({ path: url.pathname, userAgent: req.headers['user-agent'] });

        switch (url.pathname.split('/')[1]) {
            case 'ok':
                res.writeHead(200, { 'content-type': 'image/png' });
                return res.end(png);
            case 'empty':
                res.writeHead(204);
                return res.end();
            case 'missing':
                res.writeHead(404);
                return res.end('nope');
            case 'broken':
                res.writeHead(500);
                return res.end('boom');
            case 'oversized':
                res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(10 * 1024 * 1024) });
                return res.end();
            case 'oversized-chunked':
                res.writeHead(200, { 'content-type': 'image/png' });
                res.write(Buffer.alloc(3 * 1024 * 1024));
                res.write(Buffer.alloc(3 * 1024 * 1024));
                return res.end();
            default:
                res.writeHead(404);
                return res.end();
        }
    });

    await new Promise<void>((resolve) => {
        upstream.listen(0, '127.0.0.1', () => resolve());
    });

    upstreamURL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

test('buffer: returns the upstream bytes, content type and forwards headers', async () => {
    requests.length = 0;
    const basemap = new ZXYBasemap(config(`${upstreamURL}/ok/{z}/{x}/{y}.png`));

    const tile = await basemap.buffer(3, 1, 2, { headers: { 'user-agent': 'unit-test', 'accept': undefined } });

    assert.ok(tile);
    assert.equal(tile.contentType, 'image/png');
    assert.equal(tile.data.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual(requests, [{ path: '/ok/3/1/2.png', userAgent: 'unit-test' }]);
});

test('buffer: 204 and 404 upstream resolve to null', async () => {
    assert.equal(await new ZXYBasemap(config(`${upstreamURL}/empty/{z}/{x}/{y}.png`)).buffer(3, 1, 2), null);
    assert.equal(await new ZXYBasemap(config(`${upstreamURL}/missing/{z}/{x}/{y}.png`)).buffer(3, 1, 2), null);
});

test('buffer: other upstream statuses are a 502', async () => {
    await assert.rejects(
        new ZXYBasemap(config(`${upstreamURL}/broken/{z}/{x}/{y}.png`)).buffer(3, 1, 2),
        { status: 502, safe: 'Upstream tile request failed with status 500' },
    );
});

test('buffer: oversized tiles are a 413 by content-length or by bytes received', async () => {
    await assert.rejects(new ZXYBasemap(config(`${upstreamURL}/oversized/{z}/{x}/{y}.png`)).buffer(3, 1, 2), { status: 413 });
    await assert.rejects(new ZXYBasemap(config(`${upstreamURL}/oversized-chunked/{z}/{x}/{y}.png`)).buffer(3, 1, 2), { status: 413 });
});

test('buffer: tiles outside the stored bounds are null without an upstream request', async () => {
    requests.length = 0;
    const basemap = new ZXYBasemap(config(`${upstreamURL}/ok/{z}/{x}/{y}.png`, { bounds: [-110, 37, -102, 41] }));

    assert.equal(await basemap.buffer(5, 0, 0), null);
    assert.deepEqual(requests, []);

    assert.ok(await basemap.buffer(5, 6, 12));
    assert.equal(requests.length, 1);
});

test('buffer: quadkey templates are expanded', async () => {
    requests.length = 0;
    await new ZXYBasemap(config(`${upstreamURL}/ok/{q}.png`)).buffer(3, 1, 2);

    assert.deepEqual(requests.map(r => r.path), ['/ok/021.png']);
});

test('buffer: vector MapServer basemaps cannot be buffered', async () => {
    const basemap = new MapServerBasemap(config('https://example.test/arcgis/rest/services/USA/MapServer/0', {
        protocol: 'mapserver',
        type: 'vector',
        format: 'mvt',
    }));

    await assert.rejects(basemap.buffer(3, 1, 2), { status: 400, safe: 'Vector MapServer basemaps cannot be rendered as raster' });
});

test('FileTiles.fromURL resolves this server\'s own tile URLs to archives', () => {
    const path = (url: string) => FileTiles.fromURL(new URL(url))?.path ?? null;

    assert.equal(path('https://tiles.example.test/tiles/public/terrain/tiles/3/1/2.png'), 'public/terrain');
    assert.equal(path('https://tiles.example.test/api/tiles/public/terrain/tiles/3/1/2.webp?token=x'), 'public/terrain');
    assert.equal(path('https://tiles.example.test/tiles/profile/user%40example.com/upload/tiles/3/1/2.png'), 'profile/user@example.com/upload');

    assert.equal(path('https://other.example.test/tiles/public/terrain/tiles/3/1/2.png'), null);
    assert.equal(path('https://tiles.example.test/tiles/public/terrain'), null);
    assert.equal(path('https://tiles.example.test/tiles/basemap/42/tiles/3/1/2'), null);
});

test('hosted buffer: same-host URLs read the archive in process, others go over HTTP', async (t) => {
    const reads: string[] = [];
    t.mock.method(FileTiles.prototype, 'buffer', async function (this: FileTiles) {
        reads.push(this.path);
        return { data: Buffer.from('archive'), contentType: 'image/png' };
    });

    const local = new HostedBasemap(config('https://tiles.example.test/tiles/public/terrain/tiles/{z}/{x}/{y}.png', { protocol: 'hosted' }));
    const tile = await local.buffer(3, 1, 2);
    assert.equal(tile?.data.toString(), 'archive');
    assert.deepEqual(reads, ['public/terrain']);

    requests.length = 0;
    const remote = new HostedBasemap(config(`${upstreamURL}/ok/{z}/{x}/{y}.png`, { protocol: 'hosted' }));
    assert.ok(await remote.buffer(3, 1, 2));
    assert.deepEqual(requests.map(r => r.path), ['/ok/3/1/2.png']);
    assert.deepEqual(reads, ['public/terrain']);
});

test('Teardown', async () => {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => {
        upstream.close(() => resolve());
    });
});
