import { describe, expect, it } from 'vitest';
import { COORD_MODES, coordModeAt, coordModesAt, formatCoordPair, parseCoordPair, validateCoordPair } from './coordinateFormat.ts';

describe('coordinateFormat', () => {
    const lat = 39.739236;
    const lng = -104.990251;

    it('supports all configured coordinate modes', () => {
        expect(COORD_MODES.map((mode) => mode.value)).toEqual(['dd', 'dm', 'dms', 'mgrs', 'utm', 'bng']);
    });

    it.each(COORD_MODES.map((mode) => mode.value).filter((mode) => mode !== 'bng'))('round-trips %s coordinates', (mode) => {
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

    it.each([
        [52.65798, 1.71605, 'TG 51409 13177'],
        [51.5072, -0.1276, 'TQ 30043 80358'],
        [55.9533, -3.1883, 'NT 25897 74001'],
        [60.1545, -1.1494, 'HU 47323 41416'],
        [50.0661, -5.7147, 'SW 34264 25054'],
    ])('formats %f, %f as %s', (bngLat, bngLng, expected) => {
        expect(formatCoordPair(bngLat, bngLng, 'bng')).toBe(expected);

        const parsed = parseCoordPair(expected, 'bng');
        expect(parsed[0]).toBeCloseTo(bngLat, 4);
        expect(parsed[1]).toBeCloseTo(bngLng, 4);
        expect(validateCoordPair(expected, 'bng')).toBe('');
    });

    it('parses BNG references at lower precision, unspaced and as numeric eastings and northings', () => {
        const full = parseCoordPair('TG 51409 13177', 'bng');

        expect(parseCoordPair('tg5140913177', 'bng')).toEqual(full);
        expect(parseCoordPair('651409, 313177', 'bng')).toEqual(full);

        const coarse = parseCoordPair('TG 514 131', 'bng');
        expect(coarse[0]).toBeCloseTo(full[0], 2);
        expect(coarse[1]).toBeCloseTo(full[1], 2);
    });

    it('detects BNG references without a mode', () => {
        expect(parseCoordPair('TG 51409 13177')).toEqual(parseCoordPair('TG 51409 13177', 'bng'));
    });

    it('reports positions and references outside the grid', () => {
        expect(formatCoordPair(lat, lng, 'bng')).toBe('Outside BNG area');
        expect(validateCoordPair('TG 5140 131', 'bng')).not.toBe('');
        expect(validateCoordPair('AA 00000 00000', 'bng')).not.toBe('');
        expect(validateCoordPair('900000, 100000', 'bng')).not.toBe('');
    });

    it('lists only the modes defined at a location', () => {
        const values = (at: [number, number]) => coordModesAt(at[0], at[1]).map((mode) => mode.value);

        expect(values([51.5072, -0.1276])).toEqual(['dd', 'dm', 'dms', 'mgrs', 'utm', 'bng']);
        expect(values([lat, lng])).toEqual(['dd', 'dm', 'dms', 'mgrs', 'utm']);
        expect(values([-85, 0])).toEqual(['dd', 'dm', 'dms']);
        expect(values([88, 0])).toEqual(['dd', 'dm', 'dms']);
    });

    it('excludes BNG inside its bounding box but off the grid', () => {
        expect(coordModesAt(53.27, -9.05).map((mode) => mode.value)).not.toContain('bng');
    });

    it('falls back when the preferred mode is not defined at a location', () => {
        expect(coordModeAt('bng', 51.5072, -0.1276)).toBe('bng');
        expect(coordModeAt('bng', lat, lng)).toBe('dd');
        expect(coordModeAt('mgrs', -85, 0)).toBe('dd');
        expect(coordModeAt('mgrs', lat, lng)).toBe('mgrs');
    });
});
