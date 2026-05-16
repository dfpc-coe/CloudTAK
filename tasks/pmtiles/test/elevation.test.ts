import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import type { LineString } from 'geojson';
import getElevationProfile from '../src/lib/elevation.js';

function encodeMapboxElevation(elevation: number): [number, number, number] {
    const value = Math.round((elevation + 10000) * 10);

    return [
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff,
    ];
}

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

test('getElevationProfile samples elevations across covered tiles', async () => {
    const originalFetch = globalThis.fetch;
    const requests: string[] = [];
    const leftTile = createTile(100);
    const rightTile = createTile(200);
    const geometry: LineString = {
        type: 'LineString',
        coordinates: [
            [-10, 1],
            [10, 1],
        ]
    };

    globalThis.fetch = async (input) => {
        const url = String(input);
        requests.push(url);

        if (url.endsWith('/2/1/1.png')) {
            return new Response(new Uint8Array(leftTile), {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            });
        }

        if (url.endsWith('/2/2/1.png')) {
            return new Response(new Uint8Array(rightTile), {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            });
        }

        return new Response(null, { status: 404 });
    };

    try {
        const profile = await getElevationProfile('https://example.test/terrain/{z}/{x}/{y}.png', geometry, {
            zoom: 2,
            minSampleDistance: 500,
            maxSampleDistance: 500,
            concurrency: 4,
        });

        assert.equal(profile.zoom, 2);
        assert.equal(profile.tileCount, 2);
        assert.equal(profile.encoding, 'mapbox');
        assert.equal(profile.stepDistance, 500);
        assert.ok(profile.distance > 2000);
        assert.ok(profile.samples.length >= 5);
        assert.equal(profile.samples[0]?.elevation, 100);
        assert.equal(profile.samples.at(-1)?.elevation, 200);
        assert.ok(profile.samples.some((sample) => sample.elevation === 100));
        assert.ok(profile.samples.some((sample) => sample.elevation === 200));

        assert.deepEqual(new Set(requests), new Set([
            'https://example.test/terrain/2/1/1.png',
            'https://example.test/terrain/2/2/1.png',
        ]));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('getElevationProfile decodes WebP raster-dem tiles', async () => {
    const originalFetch = globalThis.fetch;
    const webp = await sharp(createTile(321)).webp({ lossless: true }).toBuffer();
    const webpTile = webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.byteLength) as ArrayBuffer;
    const geometry: LineString = {
        type: 'LineString',
        coordinates: [
            [-10, 1],
            [10, 1],
        ]
    };

    globalThis.fetch = async (input) => {
        const url = String(input);

        if (url === 'https://example.test/terrain/2/1/1.webp' || url === 'https://example.test/terrain/2/2/1.webp') {
            return new Response(webpTile, {
                status: 200,
                headers: {
                    'Content-Type': 'image/webp'
                }
            });
        }

        return new Response(null, { status: 404 });
    };

    try {
        const profile = await getElevationProfile('https://example.test/terrain/{z}/{x}/{y}.webp', geometry, {
            zoom: 2,
            minSampleDistance: 500,
            maxSampleDistance: 500,
        });

        assert.ok(profile.samples.every((sample) => sample.elevation === 321));
    } finally {
        globalThis.fetch = originalFetch;
    }
});