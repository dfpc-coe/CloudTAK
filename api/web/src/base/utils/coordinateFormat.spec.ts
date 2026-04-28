import { describe, expect, it } from 'vitest';
import { COORD_MODES, formatCoordPair, parseCoordPair, validateCoordPair } from './coordinateFormat.ts';

describe('coordinateFormat', () => {
    const lat = 39.739236;
    const lng = -104.990251;

    it('supports all configured coordinate modes', () => {
        expect(COORD_MODES.map((mode) => mode.value)).toEqual(['dd', 'dm', 'dms', 'mgrs', 'utm']);
    });

    it.each(COORD_MODES.map((mode) => mode.value))('round-trips %s coordinates', (mode) => {
        const formatted = formatCoordPair(lat, lng, mode);
        const parsed = parseCoordPair(formatted, mode);

        expect(parsed[0]).toBeCloseTo(lat, mode === 'mgrs' ? 3 : 4);
        expect(parsed[1]).toBeCloseTo(lng, mode === 'mgrs' ? 3 : 4);
        expect(validateCoordPair(formatted, mode)).toBe('');
    });

    it('parses signed decimal coordinate pairs', () => {
        expect(parseCoordPair('39.135606, -110.0', 'dd')).toEqual([39.135606, -110]);
        expect(validateCoordPair('39.135606, -110.0', 'dd')).toBe('');
    });
});
