import { describe, expect, it } from 'vitest';
import {
    MAX_LAYERS,
    compositeTileJSONURL,
    compositeTileURL,
    decodeSpec,
    encodeSpec,
    isCompositeURL,
    parseCompositeSource,
    validateSpec,
} from './composite.ts';
import type { CompositeSpec } from './composite.ts';

const HOST = 'https://tiles.example.com';

const spec: CompositeSpec = {
    tilesize: 256,
    format: 'png',
    layers: [
        { basemap: 3, opacity: 1, blend: 'over', greyscale: false },
        { basemap: 9, opacity: 0.5, blend: 'multiply', greyscale: true, minzoom: 4 },
    ],
};

describe('composite spec encoding', () => {
    it('round trips through base64url', () => {
        const encoded = encodeSpec(spec);

        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(decodeSpec(encoded)).toEqual(spec);
    });

    it('fills defaults and preserves fields the editor does not expose', () => {
        const decoded = decodeSpec(encodeSpec({
            layers: [{ basemap: 2, transparent: { color: [255, 255, 255], tolerance: 4 } }],
        } as unknown as CompositeSpec));

        expect(decoded).toEqual({
            tilesize: 256,
            format: 'png',
            layers: [{
                basemap: 2,
                opacity: 1,
                blend: 'over',
                greyscale: false,
                transparent: { color: [255, 255, 255], tolerance: 4 },
            }],
        });
    });

    it('rejects junk', () => {
        expect(decodeSpec('not base64')).toBeNull();
        expect(decodeSpec(encodeSpec({ nope: true } as unknown as CompositeSpec))).toBeNull();
    });
});

describe('composite source urls', () => {
    it('builds and parses tile and TileJSON urls', () => {
        const url = compositeTileURL(HOST, spec);

        expect(url).toBe(`${HOST}/tiles/composite/${encodeSpec(spec)}/tiles/{z}/{x}/{y}`);
        expect(compositeTileJSONURL(HOST, spec)).toBe(`${HOST}/tiles/composite/${encodeSpec(spec)}`);
        expect(isCompositeURL(url)).toBe(true);
        expect(parseCompositeSource(url)).toEqual({ host: HOST, spec });
    });

    it('ignores other PMTiles urls', () => {
        expect(isCompositeURL(`${HOST}/tiles/slope/1/tiles/{z}/{x}/{y}`)).toBe(false);
        expect(parseCompositeSource(`${HOST}/tiles/public/x/tiles/{z}/{x}/{y}`)).toBeNull();
    });
});

describe('validateSpec', () => {
    it('accepts a well formed stack', () => {
        expect(validateSpec(spec)).toBe('');
    });

    it('enforces the layer count and per-layer ranges', () => {
        expect(validateSpec({ ...spec, layers: [] })).toMatch(/at least one/i);
        expect(validateSpec({
            ...spec,
            layers: Array.from({ length: MAX_LAYERS + 1 }, (_, i) => ({ basemap: i + 1, opacity: 1, blend: 'over' as const, greyscale: false })),
        })).toMatch(/at most 8/i);
        expect(validateSpec({ ...spec, layers: [{ ...spec.layers[0], opacity: 2 }] })).toMatch(/opacity/i);
        expect(validateSpec({ ...spec, layers: [{ ...spec.layers[0], minzoom: 10, maxzoom: 4 }] })).toMatch(/minzoom/i);
    });
});
