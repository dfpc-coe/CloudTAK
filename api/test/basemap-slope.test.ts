import test from 'node:test';
import assert from 'node:assert';
import SlopeBasemap, { SLOPE_CLASSES } from '../stateless/lib/basemap/slope.js';
import { BasemapTerrain_Encoding } from '../common/enums.js';

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

test('SlopeBasemap: isValidURL requires a ZXY template', () => {
    const slope = new SlopeBasemap();

    slope.isValidURL('https://tiles.mapterhorn.com/{z}/{x}/{y}.webp');
    slope.isValidURL('https://tiles.mapterhorn.com/{$z}/{$x}/{$y}.webp');

    assert.throws(() => slope.isValidURL('https://tiles.mapterhorn.com/tilejson.json'));
});

test('SlopeBasemap: decode terrarium and mapbox encodings', () => {
    // 1000m in each encoding
    const terrarium = SlopeBasemap.decode(Uint8Array.from([131, 232, 0]), 3, 1, BasemapTerrain_Encoding.TERRARIUM);
    const mapbox = SlopeBasemap.decode(Uint8Array.from([1, 173, 176]), 3, 1, BasemapTerrain_Encoding.MAPBOX);

    assert.equal(terrarium[0], 1000);
    assert.ok(Math.abs(mapbox[0] - 1000) < 1e-3);
});

test('SlopeBasemap: slope recovers planar angles across latitudes', () => {
    for (const [z, y] of [[14, 6187], [12, 1000], [10, 400]]) {
        for (const degrees of [0, 20, 33, 40]) {
            const slope = SlopeBasemap.slope({ size: SIZE, elevation: plane(degrees, z, y) }, z, y);

            const centre = slope[(SIZE / 2) * SIZE + SIZE / 2];
            assert.ok(Math.abs(centre - degrees) < 0.05, `z${z}/${y} ${degrees}° -> ${centre}`);
        }
    }
});

test('SlopeBasemap: colorize maps angles onto avalanche classes', () => {
    const rgba = SlopeBasemap.colorize(Float32Array.from([10, 27, 32, 38, 47, 60]));

    assert.deepEqual([...rgba.subarray(0, 4)], [0, 0, 0, 0]);
    assert.deepEqual([...rgba.subarray(4, 8)], SLOPE_CLASSES[0][1]);
    assert.deepEqual([...rgba.subarray(8, 12)], SLOPE_CLASSES[1][1]);
    assert.deepEqual([...rgba.subarray(12, 16)], SLOPE_CLASSES[2][1]);
    assert.deepEqual([...rgba.subarray(16, 20)], SLOPE_CLASSES[3][1]);
    assert.deepEqual([...rgba.subarray(20, 24)], SLOPE_CLASSES[4][1]);
});

test('SlopeBasemap: upsample takes the child quadrant of a parent DEM', () => {
    const parent = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < parent.length; i++) parent[i] = i % SIZE;

    // Child (1, 0) one level down covers the eastern half of the parent
    const child = SlopeBasemap.upsample({ size: SIZE, elevation: parent }, 1, 1, 0);

    assert.equal(child.size, SIZE);
    assert.ok(Math.abs(child.elevation[SIZE / 2] - (SIZE / 2 + SIZE / 4 - 0.25)) < 1e-3);
    assert.ok(child.elevation[0] >= SIZE / 2 - 1);
});

test('SlopeBasemap: legend mirrors the slope classes', () => {
    const legend = new SlopeBasemap().legend();

    assert.deepEqual(legend.map((entry) => entry.label), ['27-30°', '30-35°', '35-45°', '45-50°', '50°+']);
    assert.equal(legend[0].color, 'rgba(255, 235, 59, 0.78)');
});
