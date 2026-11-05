import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { solid, pixel, dimensions, near } from './lib/raster.js';
import {
    validateSpec,
    encodeSpec,
    decodeSpec,
    specHash,
    renderComposite,
    compositeContentType,
    type CompositeSource,
} from '../lib/composite.js';

/** A source that always returns the same tile and records what was asked for */
function source(png: Buffer | null, opts: { minzoom?: number; maxzoom?: number } = {}): CompositeSource & { calls: number[][] } {
    const calls: number[][] = [];
    return {
        minzoom: opts.minzoom ?? 0,
        maxzoom: opts.maxzoom ?? 16,
        calls,
        tile: async (z, x, y) => {
            calls.push([z, x, y]);
            return png ? { data: png, contentType: 'image/png' } : null;
        },
    };
}

test('validateSpec fills defaults without mutating the input', () => {
    const input = { layers: [{ basemap: 1 }, { basemap: 2, opacity: 0.5, transparent: { color: [255, 255, 255] } }] };
    const spec = validateSpec(input);

    assert.deepEqual(spec, {
        tilesize: 256,
        format: 'png',
        background: [0, 0, 0, 0],
        layers: [
            { basemap: 1, opacity: 1, blend: 'over', greyscale: false },
            { basemap: 2, opacity: 0.5, blend: 'over', greyscale: false, transparent: { color: [255, 255, 255], tolerance: 0 } },
        ],
    });
    assert.deepEqual(input, { layers: [{ basemap: 1 }, { basemap: 2, opacity: 0.5, transparent: { color: [255, 255, 255] } }] });
});

test('validateSpec rejects bad input', () => {
    assert.throws(() => validateSpec(null), { status: 400 });
    assert.throws(() => validateSpec({ layers: [] }), { status: 400 });
    assert.throws(() => validateSpec({ layers: [{ basemap: 1, blend: 'subtract' }] }), { status: 400 });
    assert.throws(() => validateSpec({ layers: [{ basemap: 1, opacity: 2 }] }), { status: 400 });
    assert.throws(() => validateSpec({ tilesize: 1024, layers: [{ basemap: 1 }] }), { status: 400 });
    assert.throws(() => validateSpec({ layers: [{ basemap: 1, minzoom: 8, maxzoom: 4 }] }), { status: 400, safe: /minzoom exceeds maxzoom/ });
    assert.throws(() => validateSpec({ layers: Array.from({ length: 9 }, (_, i) => ({ basemap: i + 1 })) }), { status: 400 });
});

test('decodeSpec round trips encodeSpec and rejects garbage', () => {
    const spec = decodeSpec(encodeSpec({ format: 'webp', layers: [{ basemap: 7 }] }));

    assert.equal(spec.format, 'webp');
    assert.equal(spec.layers[0].basemap, 7);

    assert.throws(() => decodeSpec('!!!not-json'), { status: 400, safe: /base64url encoded JSON/ });
    assert.throws(() => decodeSpec('a'.repeat(5000)), { status: 400, safe: /too long/ });
});

test('specHash ignores key order and changes with extras', () => {
    const a = validateSpec({ layers: [{ basemap: 1, opacity: 0.5 }] });
    const b = validateSpec({ layers: [{ opacity: 0.5, basemap: 1 }] });

    assert.equal(specHash(a), specHash(b));
    assert.notEqual(specHash(a), specHash(a, [[1, 'https://a', '2026-01-01']]));
    assert.notEqual(specHash(a, [[1, 'https://a', '2026-01-01']]), specHash(a, [[1, 'https://a', '2026-01-02']]));
});

test('compositeContentType maps every format', () => {
    assert.equal(compositeContentType('png'), 'image/png');
    assert.equal(compositeContentType('webp'), 'image/webp');
    assert.equal(compositeContentType('jpeg'), 'image/jpeg');
});

test('render: half-opaque layer over a base', async () => {
    const spec = validateSpec({ layers: [{ basemap: 1 }, { basemap: 2, opacity: 0.5 }] });

    const out = await renderComposite(3, 1, 2, spec, [source(await solid(255, 0, 0)), source(await solid(0, 0, 255))]);

    assert.ok(out);
    near(await pixel(out), [128, 0, 128, 255]);
});

test('render: multiply blend', async () => {
    const spec = validateSpec({ layers: [{ basemap: 1 }, { basemap: 2, blend: 'multiply' }] });

    const out = await renderComposite(3, 1, 2, spec, [source(await solid(255, 0, 0)), source(await solid(128, 128, 128))]);

    assert.ok(out);
    near(await pixel(out), [128, 0, 0, 255]);
});

test('render: greyscale layer keeps four channels', async () => {
    const spec = validateSpec({ layers: [{ basemap: 1, greyscale: true }] });

    const out = await renderComposite(3, 1, 2, spec, [source(await solid(255, 0, 0))]);

    assert.ok(out);
    near(await pixel(out), [54, 54, 54, 255]);
});

test('render: modulate darkens a layer and keeps four channels', async () => {
    const spec = validateSpec({ layers: [{ basemap: 1, modulate: { brightness: 0.5 } }] });

    const out = await renderComposite(3, 1, 2, spec, [source(await solid(200, 200, 200))]);

    assert.ok(out);
    const px = await pixel(out);
    assert.equal(px.length, 4);
    assert.equal(px[3], 255);
    assert.ok(px[0] < 150 && px[0] > 50, `darkened: ${px}`);
});

test('render: sources are resized to the composite tilesize', async () => {
    const down = await renderComposite(3, 1, 2, validateSpec({ layers: [{ basemap: 1 }] }), [source(await solid(0, 255, 0, 1, 512))]);
    assert.ok(down);
    assert.deepEqual(await dimensions(down), [256, 256]);
    near(await pixel(down), [0, 255, 0, 255]);

    const up = await renderComposite(3, 1, 2, validateSpec({ tilesize: 512, layers: [{ basemap: 1 }] }), [source(await solid(0, 255, 0))]);
    assert.ok(up);
    assert.deepEqual(await dimensions(up), [512, 512]);
});

test('render: overzoom extracts the parent quadrant', async () => {
    // Left half red, right half blue
    const parent = await sharp(await solid(255, 0, 0))
        .composite([{ input: await solid(0, 0, 255, 1, 128), left: 128, top: 0 }])
        .png()
        .toBuffer();

    const spec = validateSpec({ layers: [{ basemap: 1 }] });

    const right = source(parent, { maxzoom: 2 });
    const rightTile = await renderComposite(4, 3, 0, spec, [right]);
    assert.deepEqual(right.calls, [[2, 0, 0]]);
    assert.ok(rightTile);
    near(await pixel(rightTile, 128, 128), [0, 0, 255, 255]);

    const leftTile = await renderComposite(4, 0, 0, spec, [source(parent, { maxzoom: 2 })]);
    assert.ok(leftTile);
    near(await pixel(leftTile, 128, 128), [255, 0, 0, 255]);

    const tooDeep = source(parent, { maxzoom: 2 });
    assert.equal(await renderComposite(7, 0, 0, spec, [tooDeep]), null);
    assert.deepEqual(tooDeep.calls, []);
});

test('render: colour key makes matching pixels transparent', async () => {
    const spec = validateSpec({ layers: [{ basemap: 1, transparent: { color: [250, 0, 0], tolerance: 10 } }] });

    const out = await renderComposite(3, 1, 2, spec, [source(await solid(255, 0, 0))]);

    assert.ok(out);
    assert.equal((await pixel(out))[3], 0);
});

test('render: layer and source zoom ranges hide layers', async () => {
    const red = await solid(255, 0, 0);

    assert.equal(await renderComposite(3, 0, 0, validateSpec({ layers: [{ basemap: 1, minzoom: 5 }] }), [source(red)]), null);
    assert.equal(await renderComposite(9, 0, 0, validateSpec({ layers: [{ basemap: 1, maxzoom: 8 }] }), [source(red)]), null);
    assert.equal(await renderComposite(3, 0, 0, validateSpec({ layers: [{ basemap: 1 }] }), [source(red, { minzoom: 5 })]), null);
});

test('render: a source with no tile is skipped, not fatal', async () => {
    const out = await renderComposite(3, 0, 0, validateSpec({ layers: [{ basemap: 1 }, { basemap: 2 }] }), [
        source(await solid(255, 0, 0)),
        source(null),
    ]);

    assert.ok(out);
    near(await pixel(out), [255, 0, 0, 255]);
});

test('render: background shows through where layers are transparent', async () => {
    const spec = validateSpec({ background: [0, 0, 255, 255], layers: [{ basemap: 1, opacity: 0.5 }] });

    const out = await renderComposite(3, 0, 0, spec, [source(await solid(255, 0, 0))]);

    assert.ok(out);
    near(await pixel(out), [128, 0, 128, 255]);
});

test('render: jpeg output is opaque', async () => {
    const spec = validateSpec({ format: 'jpeg', background: [255, 255, 255, 0], layers: [{ basemap: 1, opacity: 0.5 }] });

    const out = await renderComposite(3, 0, 0, spec, [source(await solid(0, 0, 0))]);

    assert.ok(out);
    near(await pixel(out), [128, 128, 128], 4);
});

test('render: webp output keeps alpha', async () => {
    const spec = validateSpec({ format: 'webp', layers: [{ basemap: 1, opacity: 0.5 }] });

    const out = await renderComposite(3, 0, 0, spec, [source(await solid(255, 0, 0))]);

    assert.ok(out);
    near(await pixel(out), [255, 0, 0, 128]);
});

test('render: non-image tiles are a 400 naming the layer', async () => {
    await assert.rejects(
        renderComposite(3, 0, 0, validateSpec({ layers: [{ basemap: 9 }] }), [source(Buffer.from('not an image'))]),
        { status: 400, safe: /Layer 9 tile is not a supported raster image/ },
    );
});

test('render: source count must match the layer count', async () => {
    await assert.rejects(
        renderComposite(3, 0, 0, validateSpec({ layers: [{ basemap: 1 }] }), []),
        { status: 500 },
    );
});
