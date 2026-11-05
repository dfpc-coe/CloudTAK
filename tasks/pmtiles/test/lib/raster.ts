import assert from 'node:assert/strict';
import sharp from 'sharp';

/** A square PNG of one colour */
export async function solid(r: number, g: number, b: number, alpha = 1, size = 256): Promise<Buffer> {
    return await sharp({ create: { width: size, height: size, channels: 4, background: { r, g, b, alpha } } })
        .png()
        .toBuffer();
}

/** Channel values of one pixel - three entries for an opaque JPEG, four for RGBA */
export async function pixel(image: Buffer | ArrayBuffer, x = 0, y = 0): Promise<number[]> {
    const { data, info } = await sharp(Buffer.isBuffer(image) ? image : Buffer.from(image)).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return Array.from(data.subarray(i, i + info.channels));
}

export async function dimensions(image: Buffer): Promise<[number, number]> {
    const meta = await sharp(image).metadata();
    return [meta.width, meta.height];
}

/** Assert channel values match within a tolerance that absorbs encoder rounding */
export function near(actual: number[], expected: number[], tolerance = 2): void {
    assert.equal(actual.length, expected.length, `channel count ${actual.length} vs ${expected.length}`);
    actual.forEach((value, i) => {
        assert.ok(Math.abs(value - expected[i]) <= tolerance, `channel ${i}: ${value} vs ${expected[i]} in [${actual}]`);
    });
}
