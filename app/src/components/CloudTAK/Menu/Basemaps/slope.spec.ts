import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SLOPE_CLASSES,
    isSlopeURL,
    parseSlopeArgs,
    parseSlopeLayer,
    parseSlopeSource,
    serializeSlopeLayer,
    slopeArgs,
    slopeTileJSONURL,
    slopeTileURL,
    validateSlopeClasses,
} from './slope.ts';

const HOST = 'https://tiles.example.com';

describe('slope layer params', () => {
    it('round trips a class through the lower:upper:hex form', () => {
        const slope = { lower: 27, upper: 30, color: '#FFEB3B', opacity: 78 };
        const serialized = serializeSlopeLayer(slope);

        expect(serialized).toBe('27:30:ffeb3bc7');
        expect(parseSlopeLayer(serialized)).toEqual(slope);
    });

    it('omits the alpha suffix when fully opaque', () => {
        expect(serializeSlopeLayer({ lower: 0, upper: 90, color: '#ABCDEF', opacity: 100 })).toBe('0:90:abcdef');
        expect(parseSlopeLayer('0:90:abcdef')).toEqual({ lower: 0, upper: 90, color: '#ABCDEF', opacity: 100 });
    });

    it('rejects malformed or inverted classes', () => {
        expect(parseSlopeLayer('30:27:ffffff')).toBeNull();
        expect(parseSlopeLayer('10:95:ffffff')).toBeNull();
        expect(parseSlopeLayer('10:20:red')).toBeNull();
    });
});

describe('slope args', () => {
    it('serialises classes as repeatable layer params', () => {
        expect(slopeArgs([{ lower: 30, upper: 45, color: '#FF0000', opacity: 100 }])).toEqual({ layer: ['30:45:ff0000'] });
    });

    it('parses layer params back, accepting a scalar', () => {
        expect(parseSlopeArgs(slopeArgs(DEFAULT_SLOPE_CLASSES))).toEqual(DEFAULT_SLOPE_CLASSES);
        expect(parseSlopeArgs({ layer: '0:30:00ff00' })).toEqual([{ lower: 0, upper: 30, color: '#00FF00', opacity: 100 }]);
    });

    it('falls back to the defaults when args carry no valid classes', () => {
        expect(parseSlopeArgs(undefined)).toEqual(DEFAULT_SLOPE_CLASSES);
        expect(parseSlopeArgs({ layer: ['junk'] })).toEqual(DEFAULT_SLOPE_CLASSES);
        expect(parseSlopeArgs({})).not.toBe(DEFAULT_SLOPE_CLASSES);
    });
});

describe('slope source urls', () => {
    it('builds bare tile and TileJSON urls', () => {
        expect(slopeTileURL(HOST, 7)).toBe(`${HOST}/tiles/slope/7/tiles/{z}/{x}/{y}`);
        expect(slopeTileJSONURL(HOST, 7)).toBe(`${HOST}/tiles/slope/7`);
    });

    it('parses host and dem from a stored url, with or without a query', () => {
        expect(parseSlopeSource(slopeTileURL(HOST, 12))).toEqual({ host: HOST, dem: 12 });
        expect(parseSlopeSource(`${HOST}/tiles/slope/3/tiles/{$z}/{$x}/{$y}?layer=0:30:00ff00&token=x`)).toEqual({ host: HOST, dem: 3 });
        expect(isSlopeURL(`${HOST}/tiles/slope/3/tiles/{z}/{x}/{y}`)).toBe(true);
    });

    it('ignores urls that are not slope tiles', () => {
        expect(isSlopeURL('https://example.com/tiles/{$z}/{$x}/{$y}.png')).toBe(false);
        expect(parseSlopeSource(`${HOST}/tiles/public/dem`)).toBeNull();
    });
});

describe('validateSlopeClasses', () => {
    it('accepts the defaults', () => {
        expect(validateSlopeClasses(DEFAULT_SLOPE_CLASSES)).toBe('');
    });

    it('reports empty, inverted and badly coloured classes', () => {
        expect(validateSlopeClasses([])).toMatch(/at least one/i);
        expect(validateSlopeClasses([{ lower: 40, upper: 30, color: '#FFFFFF', opacity: 50 }])).toMatch(/lower angle below/i);
        expect(validateSlopeClasses([{ lower: 0, upper: 30, color: 'red', opacity: 50 }])).toMatch(/#RRGGBB/);
    });
});
