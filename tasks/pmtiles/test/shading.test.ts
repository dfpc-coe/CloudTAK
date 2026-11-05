import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import {
    DEFAULT_SLOPE_CLASSES,
    decode,
    slope,
    colorize,
    upsample,
    fetchDEM,
    slopeLegend,
    parseSlopeLayers,
    serializeSlopeLayers,
} from '../lib/shading.js';

const SIZE = 64;

// Planar DEM rising eastward at the given angle for a tile at z/y
function plane(degrees: number, z: number, y: number): Float32Array {
    const elevation = new Float32Array(SIZE * SIZE);

    for (let py = 0; py < SIZE; py++) {
        const n = Math.PI - (2 * Math.PI * (y + (py + 0.5) / SIZE)) / 2 ** z;
        const cell = (40075016.686 * Math.cos(Math.atan(Math.sinh(n)))) / (2 ** z * SIZE);

        for (let px = 0; px < SIZE; px++) {
            elevation[py * SIZE + px] = 1000 + px * cell * Math.tan(degrees * Math.PI / 180);
        }
    }

    return elevation;
}

function mapboxTile(elevation: Float32Array): Uint8Array {
    const png = new PNG({ width: SIZE, height: SIZE });

    for (let i = 0; i < elevation.length; i++) {
        const value = Math.round((elevation[i] + 10000) * 10);
        png.data[i * 4] = (value >> 16) & 0xff;
        png.data[i * 4 + 1] = (value >> 8) & 0xff;
        png.data[i * 4 + 2] = value & 0xff;
        png.data[i * 4 + 3] = 0xff;
    }

    return new Uint8Array(PNG.sync.write(png));
}

test('shading: decode terrarium and mapbox encodings', () => {
    // 1000m in each encoding
    const terrarium = decode(Uint8Array.from([131, 232, 0]), 3, 1, 'terrarium');
    const mapbox = decode(Uint8Array.from([1, 173, 176]), 3, 1, 'mapbox');

    assert.equal(terrarium[0], 1000);
    assert.ok(Math.abs(mapbox[0] - 1000) < 1e-3);
});

test('shading: slope recovers planar angles across latitudes', () => {
    for (const [z, y] of [[14, 6187], [12, 1000], [10, 400]]) {
        for (const degrees of [0, 20, 33, 40]) {
            const angles = slope({ size: SIZE, elevation: plane(degrees, z, y) }, z, y);

            const centre = angles[(SIZE / 2) * SIZE + SIZE / 2];
            assert.ok(Math.abs(centre - degrees) < 0.05, `z${z}/${y} ${degrees}° -> ${centre}`);
        }
    }
});

test('shading: colorize maps angles onto avalanche classes', () => {
    const rgba = colorize(Float32Array.from([10, 27, 32, 38, 47, 60]));

    assert.deepEqual([...rgba.subarray(0, 4)], [0, 0, 0, 0]);
    assert.deepEqual([...rgba.subarray(4, 8)], DEFAULT_SLOPE_CLASSES[0].color);
    assert.deepEqual([...rgba.subarray(8, 12)], DEFAULT_SLOPE_CLASSES[1].color);
    assert.deepEqual([...rgba.subarray(12, 16)], DEFAULT_SLOPE_CLASSES[2].color);
    assert.deepEqual([...rgba.subarray(16, 20)], DEFAULT_SLOPE_CLASSES[3].color);
    assert.deepEqual([...rgba.subarray(20, 24)], DEFAULT_SLOPE_CLASSES[4].color);
});

test('shading: colorize honours custom bands and leaves gaps clear', () => {
    const classes = parseSlopeLayers(['0:10:00ff00', '20:90:ff000080']);
    const rgba = colorize(Float32Array.from([5, 15, 25]), classes);

    assert.deepEqual([...rgba.subarray(0, 4)], [0, 255, 0, 255]);
    assert.deepEqual([...rgba.subarray(4, 8)], [0, 0, 0, 0]);
    assert.deepEqual([...rgba.subarray(8, 12)], [255, 0, 0, 128]);
});

test('shading: parseSlopeLayers accepts scalars, arrays, # prefixes and alpha', () => {
    assert.deepEqual(parseSlopeLayers(undefined), DEFAULT_SLOPE_CLASSES);
    assert.deepEqual(parseSlopeLayers([]), DEFAULT_SLOPE_CLASSES);

    assert.deepEqual(parseSlopeLayers('30:45:FF9800'), [{ lower: 30, upper: 45, color: [255, 152, 0, 255] }]);
    assert.deepEqual(parseSlopeLayers(['27.5:30:#ffeb3b', '30:90:212121c8']), [
        { lower: 27.5, upper: 30, color: [255, 235, 59, 255] },
        { lower: 30, upper: 90, color: [33, 33, 33, 200] },
    ]);
});

test('shading: parseSlopeLayers rejects malformed layers', () => {
    assert.throws(() => parseSlopeLayers('30:45'), { status: 400, safe: /expected lower:upper:hex_color/ });
    assert.throws(() => parseSlopeLayers('30:45:red'), { status: 400 });
    assert.throws(() => parseSlopeLayers('30:45:fff'), { status: 400 });
    assert.throws(() => parseSlopeLayers('45:30:ff0000'), { status: 400, safe: /lower < upper/ });
    assert.throws(() => parseSlopeLayers('30:30:ff0000'), { status: 400 });
    assert.throws(() => parseSlopeLayers('30:95:ff0000'), { status: 400, safe: /upper <= 90/ });
    assert.throws(() => parseSlopeLayers(Array.from({ length: 17 }, (_, i) => `${i}:${i + 1}:ff0000`)), { status: 400, safe: /At most 16/ });
});

test('shading: serializeSlopeLayers round trips', () => {
    const layers = ['27.5:30:ffeb3b', '30:90:212121c8'];
    assert.deepEqual(serializeSlopeLayers(parseSlopeLayers(layers)), layers);
    assert.deepEqual(serializeSlopeLayers(parseSlopeLayers('30:45:#FF9800FF')), ['30:45:ff9800']);
});

test('shading: upsample takes the child quadrant of a parent DEM', () => {
    const parent = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < parent.length; i++) parent[i] = i % SIZE;

    // Child (1, 0) one level down covers the eastern half of the parent
    const child = upsample({ size: SIZE, elevation: parent }, 1, 1, 0);

    assert.equal(child.size, SIZE);
    assert.ok(Math.abs(child.elevation[SIZE / 2] - (SIZE / 2 + SIZE / 4 - 0.25)) < 1e-3);
    assert.ok(child.elevation[0] >= SIZE / 2 - 1);
});

test('shading: fetchDEM reads the tile at zoom and walks up parents beyond it', async () => {
    const requested: string[] = [];
    const source = {
        encoding: 'mapbox' as const,
        minzoom: 4,
        maxzoom: 12,
        tile: async (z: number, x: number, y: number) => {
            requested.push(`${z}/${x}/${y}`);
            return z === 12 && x === 2048 && y === 1024 ? mapboxTile(plane(33, 12, 1024)) : null;
        },
    };

    const direct = await fetchDEM(12, 2048, 1024, source);
    assert.ok(direct);
    assert.equal(direct.size, SIZE);
    assert.ok(Math.abs(direct.elevation[0] - 1000) < 0.1);

    requested.length = 0;
    const over = await fetchDEM(14, 8193, 4098, source);
    assert.ok(over);
    assert.deepEqual(requested, ['12/2048/1024']);
    assert.ok(Math.abs(slope(over, 14, 4098)[(SIZE / 2) * SIZE + SIZE / 2] - 33) < 0.5);

    requested.length = 0;
    assert.equal(await fetchDEM(14, 0, 0, source), null);
    assert.deepEqual(requested, ['12/0/0', '11/0/0', '10/0/0']);

    requested.length = 0;
    assert.equal(await fetchDEM(17, 0, 0, source), null);
    assert.deepEqual(requested, [], 'Nothing within MAX_OVERZOOM of z17 lies at or below maxzoom');

    requested.length = 0;
    assert.equal(await fetchDEM(5, 0, 0, source), null);
    assert.deepEqual(requested, ['5/0/0', '4/0/0'], 'Stops at minzoom');
});

test('shading: fetchDEM rejects non-image tiles', async () => {
    await assert.rejects(fetchDEM(1, 0, 0, {
        encoding: 'terrarium',
        minzoom: 0,
        maxzoom: 1,
        tile: async () => new TextEncoder().encode('not a tile'),
    }), (err: { status?: number }) => err.status === 400);
});

test('shading: legend mirrors the slope classes', () => {
    const legend = slopeLegend();

    assert.deepEqual(legend.map(entry => entry.label), ['27-30°', '30-35°', '35-45°', '45-50°', '50°+']);
    assert.equal(legend[0].color, 'rgba(255, 235, 59, 0.78)');

    const custom = slopeLegend(parseSlopeLayers(['0:30:00ff00', '30:90:ff0000']));
    assert.deepEqual(custom, [
        { label: '0-30°', color: 'rgba(0, 255, 0, 1)' },
        { label: '30°+', color: 'rgba(255, 0, 0, 1)' },
    ]);
});
