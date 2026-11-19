import assert from 'node:assert/strict';
import { Raster } from '@tak-ps/node-tiles';
import { decodeImage, encodePNG } from '@tak-ps/node-tiles/node';

/** A square PNG of one colour */
export async function solid(r: number, g: number, b: number, alpha = 1, size = 256): Promise<Buffer> {
    const raster = Raster.alloc(size, size, 4);
    const pixel = [r, g, b, Math.round(alpha * 255)];

    for (let i = 0; i < raster.data.length; i += 4) raster.data.set(pixel, i);

    return await encodePNG(raster);
}

/** Channel values of one pixel - three entries for an opaque JPEG, four for RGBA */
export async function pixel(image: Buffer | ArrayBuffer, x = 0, y = 0): Promise<number[]> {
    return (await decodeImage(image)).get(x, y);
}

export async function dimensions(image: Buffer): Promise<[number, number]> {
    const { width, height } = await decodeImage(image);
    return [width, height];
}

/** Assert channel values match within a tolerance that absorbs encoder rounding */
export function near(actual: number[], expected: number[], tolerance = 2): void {
    assert.equal(actual.length, expected.length, `channel count ${actual.length} vs ${expected.length}`);
    actual.forEach((value, i) => {
        assert.ok(Math.abs(value - expected[i]) <= tolerance, `channel ${i}: ${value} vs ${expected[i]} in [${actual}]`);
    });
}
