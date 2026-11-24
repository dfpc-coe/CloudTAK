import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COORD_MODES, formatCoordPair, parseCoordPair, setCoordinateSystems, validateCoordPair, wrapLongitude } from './coordinateFormat.ts';

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

describe('coordinateFormat - NZTM', () => {
    const nztm = {
        name: 'NZTM',
        title: 'New Zealand Transverse Mercator',
        epsg: 2193,
        proj4: '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs',
        bounds: { minLongitude: 160.6, minLatitude: -55.95, maxLongitude: -171.2, maxLatitude: -25.88 },
    };
    // Wellington
    const lat = -41.2865;
    const lng = 174.7762;

    beforeAll(() => setCoordinateSystems([nztm]));
    afterAll(() => setCoordinateSystems([]));

    it('lists the system after the built-in modes', () => {
        expect(COORD_MODES.map((mode) => mode.value)).toEqual(['dd', 'dm', 'dms', 'mgrs', 'utm', 'NZTM']);
        expect(COORD_MODES.at(-1)).toEqual({ value: 'NZTM', label: 'NZTM', title: 'New Zealand Transverse Mercator (NZTM)' });
    });

    it('puts the central meridian at the false easting', () => {
        // On the central meridian (173E) easting is the false easting and
        // northing is the false northing plus the scaled meridian arc. The arc is
        // computed here with the GRS80 series, independent of proj4.
        const e2 = 0.00669438002290;
        const a = 6378137;
        const phi = -41 * Math.PI / 180;
        const arc = a * (
            (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
            - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
            + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
            - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi)
        );

        expect(formatCoordPair(-41, 173, 'NZTM')).toBe(`E 1600000  N ${Math.round(10000000 + 0.9996 * arc)}`);
    });

    it('formats easting and northing in whole metres', () => {
        expect(formatCoordPair(lat, lng, 'NZTM')).toMatch(/^E 17\d{5} {2}N 54\d{5}$/);
    });

    it('round-trips within a metre', () => {
        const [parsedLat, parsedLng] = parseCoordPair(formatCoordPair(lat, lng, 'NZTM'), 'NZTM');
        expect(parsedLat).toBeCloseTo(lat, 4);
        expect(parsedLng).toBeCloseTo(lng, 4);
        expect(validateCoordPair(formatCoordPair(lat, lng, 'NZTM'), 'NZTM')).toBe('');
    });

    it.each([
        'E 1748500 N 5427000',
        'e 1748500 n 5427000',
        '1748500E 5427000N',
        '1748500 E, 5427000 N',
        '1748500 5427000',
        '1748500, 5427000',
        'N 5427000 E 1748500',
        '5427000N 1748500E',
    ])('parses "%s"', (text) => {
        const [parsedLat, parsedLng] = parseCoordPair(text, 'NZTM');
        expect(parsedLat).toBeCloseTo(parseCoordPair('E 1748500 N 5427000', 'NZTM')[0], 8);
        expect(parsedLng).toBeCloseTo(parseCoordPair('E 1748500 N 5427000', 'NZTM')[1], 8);
        expect(parsedLat).toBeLessThan(-40);
        expect(parsedLng).toBeGreaterThan(170);
    });

    it.each([
        '',
        'E 1748500',
        'E 1748500 E 5427000',
        '1 2 3',
        'hello',
    ])('rejects "%s"', (text) => {
        expect(validateCoordPair(text, 'NZTM')).not.toBe('');
    });

    it('explains the expected format', () => {
        expect(validateCoordPair('hello', 'NZTM')).toMatch(/^Expected NZTM coordinates like "E \d+ {2}N \d+"$/);
    });

    it('rejects an easting and northing outside the area of use', () => {
        expect(validateCoordPair('E 100 N 100', 'NZTM')).toBe('Coordinates are outside the area covered by NZTM');
    });

    it('covers the Chatham Islands across the antimeridian', () => {
        const formatted = formatCoordPair(-43.9, -176.5, 'NZTM');
        expect(formatted).toMatch(/^E \d+ {2}N \d+$/);
        expect(parseCoordPair(formatted, 'NZTM')[1]).toBeCloseTo(-176.5, 4);
    });

    it('shows -- outside the area of use', () => {
        // Denver
        expect(formatCoordPair(39.739236, -104.990251, 'NZTM')).toBe('--');
        expect(validateCoordPair('--', 'NZTM')).not.toBe('');
    });

    it('formats as degrees when the server stops offering the system', () => {
        setCoordinateSystems([]);
        expect(formatCoordPair(lat, lng, 'NZTM')).toBe(`${lat}, ${lng}`);
        setCoordinateSystems([nztm]);
    });

    it('ignores a system whose definition cannot be loaded', () => {
        setCoordinateSystems([{ ...nztm, name: 'Broken', proj4: '+proj=nonsense' }]);
        expect(COORD_MODES.map((mode) => mode.value)).toEqual(['dd', 'dm', 'dms', 'mgrs', 'utm']);
        setCoordinateSystems([nztm]);
    });
});

describe('wrapLongitude', () => {
    it('leaves in-range longitudes exactly untouched', () => {
        // Exact equality, not toBeCloseTo: the modulo arithmetic used for
        // out-of-range values perturbs these by floating point error, and the
        // result is displayed in the UI and written back into the URL.
        expect(wrapLongitude(174.7633)).toBe(174.7633);
        expect(wrapLongitude(-176.5597)).toBe(-176.5597);
        expect(wrapLongitude(0)).toBe(0);
        expect(wrapLongitude(180)).toBe(180);
        expect(wrapLongitude(-180)).toBe(-180);
    });

    it('normalises longitudes from east of the antimeridian', () => {
        // The value from the reported Query panel crash: MapLibre reported a
        // click near the Chathams as longitude 204 after panning east.
        expect(wrapLongitude(204.08162859110183)).toBeCloseTo(-155.91837140889817, 10);

        // Chatham Islands reached by panning east rather than west.
        expect(wrapLongitude(-176.5597 + 360)).toBeCloseTo(-176.5597, 10);

        // Auckland, two world copies east.
        expect(wrapLongitude(174.7633 + 720)).toBeCloseTo(174.7633, 10);
    });

    it('normalises longitudes from west of the antimeridian', () => {
        expect(wrapLongitude(-190)).toBe(170);
        expect(wrapLongitude(-360)).toBe(0);
    });

    it('passes non-finite values through for the caller to reject', () => {
        expect(wrapLongitude(NaN)).toBeNaN();
        expect(wrapLongitude(Infinity)).toBe(Infinity);
    });
});
