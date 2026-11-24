import { convert } from 'geo-coordinates-parser';
import proj4 from 'proj4';
import { shallowReactive, reactive } from 'vue';
import type { paths } from '@cloudtak/api-types';

export type BuiltinCoordMode = 'dd' | 'dm' | 'dms' | 'mgrs' | 'utm';

/**
 * A built-in mode, or the name of a coordinate system the server offers
 * (see setCoordinateSystems), ie "NZTM"
 */
export type CoordMode = string;

export type CoordSystem = paths['/api/config/coordinate-systems']['get']['responses']['200']['content']['application/json']['crs'][number];

type CoordModeInfo = { value: CoordMode; label: string; title: string };

export const BUILTIN_COORD_MODES: Array<CoordModeInfo> = [
    { value: 'dd',   label: 'DD',   title: 'Decimal Degrees (DD)' },
    { value: 'dm',   label: 'DM',   title: 'Degrees & Decimal Minutes (DM)' },
    { value: 'dms',  label: 'DMS',  title: 'Degrees, Minutes, Seconds (DMS)' },
    { value: 'mgrs', label: 'MGRS', title: 'Military Grid Reference System (MGRS)' },
    { value: 'utm',  label: 'UTM',  title: 'Universal Transverse Mercator (UTM)' },
];

/** Every mode the user can pick: the built-ins followed by the server's coordinate systems */
export const COORD_MODES: Array<CoordModeInfo> = reactive([...BUILTIN_COORD_MODES]);

type ProjectedSystem = {
    crs: CoordSystem;
    converter: proj4.Converter;
};

const projected = shallowReactive(new Map<string, ProjectedSystem>());

/**
 * Register the additional coordinate systems the server offers. Replaces any
 * registered earlier. A system whose definition proj4 rejects is skipped.
 */
export function setCoordinateSystems(systems: Array<CoordSystem>): void {
    projected.clear();
    COORD_MODES.splice(0, COORD_MODES.length, ...BUILTIN_COORD_MODES);

    for (const crs of systems) {
        if (BUILTIN_COORD_MODES.some((mode) => mode.value === crs.name.toLowerCase())) continue;

        try {
            projected.set(crs.name, { crs, converter: proj4('EPSG:4326', crs.proj4) });
            COORD_MODES.push({ value: crs.name, label: crs.name, title: `${crs.title} (${crs.name})` });
        } catch (err) {
            console.error(`Ignoring coordinate system ${crs.name}:`, err);
        }
    }
}

const K0 = 0.9996;
const E = 0.00669438;
const E_P2 = E / (1 - E);
const E2 = Math.pow(E, 2);
const E3 = Math.pow(E, 3);
const R = 6378137;

const M1 = 1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256;
const M2 = 3 * E / 8 + 3 * E2 / 32 + 45 * E3 / 1024;
const M3 = 15 * E2 / 256 + 45 * E3 / 1024;
const M4 = 35 * E3 / 3072;

const EASTING_SETS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'] as const;
const NORTHING_SETS = ['ABCDEFGHJKLMNPQRSTUV', 'FGHJKLMNPQRSTUVABCDE'] as const;

/**
 * Format a lat/lng coordinate pair as a string in the given mode.
 * @param lat      - latitude in decimal degrees
 * @param lng      - longitude in decimal degrees
 * @param mode     - target format
 * @param truncate - optional decimal precision for DD mode
 */
export function formatCoordPair(lat: number, lng: number, mode: CoordMode, truncate?: number): string {
    const system = projected.get(mode);
    if (system) {
        // Outside the system's area of use the position is shown as decimal degrees
        const text = asProjected(system, lat, lng);
        if (text) return text;
        mode = 'dd';
    } else if (!BUILTIN_COORD_MODES.some((builtin) => builtin.value === mode)) {
        // A mode the server no longer offers
        mode = 'dd';
    }

    if (mode === 'dd') {
        if (truncate !== undefined) {
            const factor = Math.pow(10, truncate);
            return [Math.trunc(lat * factor) / factor, Math.trunc(lng * factor) / factor].join(', ');
        }
        return `${lat}, ${lng}`;
    } else if (mode === 'dm') {
        return `${asDM(lat)}, ${asDM(lng)}`;
    } else if (mode === 'dms') {
        return `${asDMS(lat)}, ${asDMS(lng)}`;
    } else if (mode === 'mgrs') {
        return asMGRS(lat, lng);
    } else if (mode === 'utm') {
        return asUTM(lat, lng);
    }
    return 'UNKNOWN';
}

export function parseCoordPair(text: string, mode?: CoordMode): [number, number] {
    const raw = text.trim();

    if (!raw) {
        throw new Error('Coordinates are required');
    }

    const system = mode === undefined ? undefined : projected.get(mode);
    if (system) {
        return parseProjectedOrDegrees(system, raw);
    }

    if (mode === 'utm') {
        return parseUTM(raw);
    } else if (mode === 'mgrs') {
        return parseMGRS(raw);
    } else if (mode === 'dd' || mode === 'dm' || mode === 'dms') {
        return parseDegrees(raw);
    }

    const parsers = [parseDegrees, parseUTM, parseMGRS];

    for (const parser of parsers) {
        try {
            return parser(raw);
        } catch {
            continue;
        }
    }

    throw new Error('Unable to parse coordinates');
}

export function validateCoordPair(text: string, mode?: CoordMode): string {
    try {
        const [lat, lng] = parseCoordPair(text, mode);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return 'Coordinates must contain valid numbers';
        }

        if (lat < -90 || lat > 90) {
            return 'Latitude must be between -90° and 90°';
        }

        if (lng < -180 || lng > 180) {
            return 'Longitude must be between -180° and 180°';
        }

        return '';
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }
}

function inBounds(bounds: CoordSystem['bounds'], lat: number, lng: number): boolean {
    if (lat < bounds.minLatitude || lat > bounds.maxLatitude) return false;

    const wrapped = wrapLongitude(lng);

    // A maxLongitude below minLongitude means the area crosses the antimeridian
    return bounds.minLongitude <= bounds.maxLongitude
        ? wrapped >= bounds.minLongitude && wrapped <= bounds.maxLongitude
        : wrapped >= bounds.minLongitude || wrapped <= bounds.maxLongitude;
}

function asProjected(system: ProjectedSystem, lat: number, lng: number): string | undefined {
    if (!inBounds(system.crs.bounds, lat, lng)) return;

    const [easting, northing] = system.converter.forward([wrapLongitude(lng), lat]);
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) return;

    return `E ${Math.round(easting)}  N ${Math.round(northing)}`;
}

function projectedExample(system: ProjectedSystem): string {
    const { minLongitude, maxLongitude, minLatitude, maxLatitude } = system.crs.bounds;
    const lng = maxLongitude >= minLongitude
        ? (minLongitude + maxLongitude) / 2
        : wrapLongitude((minLongitude + maxLongitude + 360) / 2);

    return asProjected(system, (minLatitude + maxLatitude) / 2, lng) || 'E 0  N 0';
}

/**
 * Accepts an easting and northing in metres, ie "E 1748500 N 5427000",
 * "1748500E 5427000N", "1748500 E, 5427000 N", "1748500, 5427000". A letter
 * labels the number it touches, a letter between two numbers labels the next
 * one. Unlabelled numbers are easting then northing.
 */
function parseProjected(system: ProjectedSystem, text: string): [number, number] {
    const pattern = /\s*([EN])?\s*(-?\d+(?:\.\d+)?)(?:([EN])|\s*([EN])(?=\s*(?:,|$)))?\s*,?/iy;
    const found: Array<{ value: number; label?: string }> = [];

    while (pattern.lastIndex < text.length) {
        const match = pattern.exec(text);
        if (!match) break;
        found.push({ value: Number(match[2]), label: (match[1] || match[3] || match[4])?.toUpperCase() });
    }

    const expected = `Expected ${system.crs.name} coordinates like "${projectedExample(system)}"`;
    if (found.length !== 2 || pattern.lastIndex !== text.length) throw new Error(expected);

    let [first, second] = found;
    if (first.label === second.label && first.label !== undefined) throw new Error(expected);
    if (first.label === 'N' || second.label === 'E') [first, second] = [second, first];

    const [lng, lat] = system.converter.inverse([first.value, second.value]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBounds(system.crs.bounds, lat, lng)) {
        throw new Error(`Coordinates are outside the area covered by ${system.crs.name}`);
    }

    return [lat, wrapLongitude(lng)];
}

/** Outside a system's area of use positions are shown as degrees, so accept those as well */
function parseProjectedOrDegrees(system: ProjectedSystem, text: string): [number, number] {
    try {
        return parseProjected(system, text);
    } catch (err) {
        try {
            const [lat, lng] = parseDegrees(text);
            if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
        } catch {
            // Fall through to report the problem with the projected coordinate
        }
        throw err;
    }
}

function parseDegrees(text: string): [number, number] {
    const decimalPair = parseDecimalPair(text);
    if (decimalPair) return decimalPair;

    try {
        const parsed = convert(text);

        return [parsed.decimalLatitude, parsed.decimalLongitude];
    } catch {
        throw new Error('Expected a valid decimal, DM, or DMS coordinate pair');
    }
}

function parseDecimalPair(text: string): [number, number] | undefined {
    const decimal = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    const match = text.match(new RegExp(`^\\s*(${decimal})\\s*(?:,\\s*|\\s+)(${decimal})\\s*$`));
    if (!match) return;

    return [Number(match[1]), Number(match[2])];
}

function asDM(dd: number): string {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    return (dd < 0 ? '-' : '') + deg + '° ' + Math.floor(min * 10000) / 10000 + "'";
}

function asDMS(dd: number): string {
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const min = Math.floor((abs - deg) * 60);
    const sec = (abs - deg - min / 60) * 3600;
    return (dd < 0 ? '-' : '') + deg + '° ' + min + '\' ' + Math.floor(sec * 100) / 100 + '"';
}

function asUTM(latitude: number, longitude: number): string {
    const utm = latLngToUTM(latitude, longitude);
    return `${utm.zoneNum}${utm.zoneLetter} ${Math.floor(utm.easting)} ${Math.floor(utm.northing)}`;
}

function parseUTM(text: string): [number, number] {
    const match = text.trim().toUpperCase().match(/^(\d{1,2})([C-HJ-NP-X])\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/i);

    if (!match) {
        throw new Error('Expected UTM coordinates like "13S 500000 4400000"');
    }

    const zoneNum = Number(match[1]);
    const zoneLetter = match[2];
    const easting = Number(match[3]);
    const northing = Number(match[4]);

    if (!Number.isFinite(easting) || !Number.isFinite(northing) || zoneNum < 1 || zoneNum > 60) {
        throw new Error('Expected UTM coordinates like "13S 500000 4400000"');
    }

    return utmToLatLng(zoneNum, zoneLetter, easting, northing);
}

function parseMGRS(text: string): [number, number] {
    const normalized = text.trim().toUpperCase().replace(/\s+/g, '');
    const match = normalized.match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d{0,10})$/i);

    if (!match) {
        throw new Error('Expected MGRS coordinates like "13S EC 12345 67890"');
    }

    const zoneNum = Number(match[1]);
    const zoneLetter = match[2];
    const [columnLetter, rowLetter] = match[3].split('');
    const digits = match[4] || '';

    if (digits.length % 2 !== 0 || zoneNum < 1 || zoneNum > 60) {
        throw new Error('Expected MGRS coordinates like "13S EC 12345 67890"');
    }

    const eastingSet = EASTING_SETS[(zoneNum - 1) % EASTING_SETS.length];
    const northingSet = NORTHING_SETS[(zoneNum - 1) % NORTHING_SETS.length];

    const columnIndex = eastingSet.indexOf(columnLetter);
    const rowIndex = northingSet.indexOf(rowLetter);

    if (columnIndex === -1 || rowIndex === -1) {
        throw new Error('Expected MGRS coordinates like "13S EC 12345 67890"');
    }

    const precision = digits.length / 2;
    const eastingRemainder = precision ? Number(digits.slice(0, precision).padEnd(5, '0')) : 0;
    const northingRemainder = precision ? Number(digits.slice(precision).padEnd(5, '0')) : 0;

    const easting = (columnIndex + 1) * 100000 + eastingRemainder;
    let northing = rowIndex * 100000 + northingRemainder;

    const minNorthing = minimumNorthingForZoneLetter(zoneLetter, zoneNum);
    while (northing < minNorthing) {
        northing += 2000000;
    }

    return utmToLatLng(zoneNum, zoneLetter, easting, northing);
}

function latLngToUTM(latitude: number, longitude: number): {
    zoneNum: number;
    zoneLetter: string;
    easting: number;
    northing: number;
} {
    const latRad = toRadians(latitude);
    const latSin = Math.sin(latRad);
    const latCos = Math.cos(latRad);
    const latTan = Math.tan(latRad);
    const latTan2 = Math.pow(latTan, 2);
    const latTan4 = Math.pow(latTan, 4);

    const zoneNum = latLonToZoneNumber(latitude, longitude);
    const zoneLetter = latitudeToZoneLetter(latitude);

    if (!zoneLetter) {
        throw new Error('Latitude is outside supported UTM bounds');
    }

    const lonRad = toRadians(longitude);
    const centralLonRad = toRadians(zoneNumberToCentralLongitude(zoneNum));

    const n = R / Math.sqrt(1 - E * latSin * latSin);
    const c = E_P2 * latCos * latCos;
    const a = latCos * (lonRad - centralLonRad);
    const a2 = Math.pow(a, 2);
    const a3 = Math.pow(a, 3);
    const a4 = Math.pow(a, 4);
    const a5 = Math.pow(a, 5);
    const a6 = Math.pow(a, 6);

    const m = R * (M1 * latRad -
        M2 * Math.sin(2 * latRad) +
        M3 * Math.sin(4 * latRad) -
        M4 * Math.sin(6 * latRad));

    const easting = K0 * n * (a +
        a3 / 6 * (1 - latTan2 + c) +
        a5 / 120 * (5 - 18 * latTan2 + latTan4 + 72 * c - 58 * E_P2)) + 500000;

    let northing = K0 * (m + n * latTan * (a2 / 2 +
        a4 / 24 * (5 - latTan2 + 9 * c + 4 * c * c) +
        a6 / 720 * (61 - 58 * latTan2 + latTan4 + 600 * c - 330 * E_P2)));

    if (latitude < 0) {
        northing += 10000000;
    }

    return {
        zoneNum,
        zoneLetter,
        easting,
        northing,
    };
}

function utmToLatLng(zoneNum: number, zoneLetter: string, easting: number, northing: number): [number, number] {
    const x = easting - 500000;
    let y = northing;

    if (zoneLetter < 'N') {
        y -= 10000000;
    }

    const m = y / K0;
    const mu = m / (R * (1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256));
    const e1 = (1 - Math.sqrt(1 - E)) / (1 + Math.sqrt(1 - E));

    const j1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
    const j2 = 21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32;
    const j3 = 151 * Math.pow(e1, 3) / 96;
    const j4 = 1097 * Math.pow(e1, 4) / 512;

    const fp = mu +
        j1 * Math.sin(2 * mu) +
        j2 * Math.sin(4 * mu) +
        j3 * Math.sin(6 * mu) +
        j4 * Math.sin(8 * mu);

    const sinFp = Math.sin(fp);
    const cosFp = Math.cos(fp);
    const tanFp = Math.tan(fp);

    const c1 = E_P2 * Math.pow(cosFp, 2);
    const t1 = Math.pow(tanFp, 2);
    const n1 = R / Math.sqrt(1 - E * Math.pow(sinFp, 2));
    const r1 = R * (1 - E) / Math.pow(1 - E * Math.pow(sinFp, 2), 1.5);
    const d = x / (n1 * K0);

    const lat = fp - (n1 * tanFp / r1) * (
        Math.pow(d, 2) / 2 -
        (5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * E_P2) * Math.pow(d, 4) / 24 +
        (61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 252 * E_P2 - 3 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720
    );

    const lon = toRadians(zoneNumberToCentralLongitude(zoneNum)) + (
        d -
        (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6 +
        (5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * E_P2 + 24 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120
    ) / cosFp;

    return [toDegrees(lat), toDegrees(lon)];
}

function minimumNorthingForZoneLetter(zoneLetter: string, zoneNum: number): number {
    const bands = 'CDEFGHJKLMNPQRSTUVWX';
    const index = bands.indexOf(zoneLetter);

    if (index === -1) {
        throw new Error('Expected a valid MGRS zone letter');
    }

    const minLatitude = zoneLetter === 'X' ? 72 : -80 + index * 8;
    return latLngToUTM(minLatitude, zoneNumberToCentralLongitude(zoneNum)).northing;
}

function zoneNumberToCentralLongitude(zoneNum: number): number {
    return (zoneNum - 1) * 6 - 180 + 3;
}

function toRadians(deg: number): number {
    return deg * Math.PI / 180;
}

function toDegrees(rad: number): number {
    return rad * 180 / Math.PI;
}

function latitudeToZoneLetter(latitude: number): string | null {
    const zoneLetters = 'CDEFGHJKLMNPQRSTUVWXX';

    if (-80 <= latitude && latitude <= 84) {
        return zoneLetters[Math.floor((latitude + 80) / 8)];
    }

    return null;
}

function latLonToZoneNumber(latitude: number, longitude: number): number {
    if (56 <= latitude && latitude < 64 && 3 <= longitude && longitude < 12) return 32;

    if (72 <= latitude && latitude <= 84 && longitude >= 0) {
        if (longitude < 9) return 31;
        if (longitude < 21) return 33;
        if (longitude < 33) return 35;
        if (longitude < 42) return 37;
    }

    return Math.floor((longitude + 180) / 6) + 1;
}

function asMGRS(lat: number, lng: number): string {
    if (lat < -80) return 'Too far South';
    if (lat > 84) return 'Too far North';

    const utm = latLngToUTM(lat, lng);
    const eastingBand = EASTING_SETS[(utm.zoneNum - 1) % EASTING_SETS.length];
    const northingBand = NORTHING_SETS[(utm.zoneNum - 1) % NORTHING_SETS.length];

    const firstLetter = eastingBand[Math.floor(utm.easting / 100000) - 1];
    const secondLetter = northingBand[Math.floor(utm.northing / 100000) % 20];

    return `${utm.zoneNum}${utm.zoneLetter} ${firstLetter}${secondLetter} ${pad(Math.floor(utm.easting % 100000))} ${pad(Math.floor(utm.northing % 100000))}`;
}

function pad(val: number): string {
    if (val < 10) return '0000' + val;
    if (val < 100) return '000' + val;
    if (val < 1000) return '00' + val;
    if (val < 10000) return '0' + val;
    return String(val);
}

/**
 * Normalise a longitude into [-180, 180].
 *
 * MapLibre reports coordinates in whichever unwrapped world copy the pointer is
 * over, so panning east across the antimeridian produces longitudes beyond the
 * valid range - a click near the Chatham Islands can arrive as 204. Values like
 * that are out of spec for GeoJSON and CoT, and the reverse-geocode, sun, weather
 * and magnetic endpoints all reject them.
 *
 * Map event handlers normalise at the point of capture via MapLibre's
 * `LngLat.wrap()`. This helper covers the paths where a raw number arrives
 * instead, such as coordinates parsed back out of a bookmarked or shared URL.
 */
export function wrapLongitude(longitude: number): number {
    if (!Number.isFinite(longitude)) return longitude;

    // Return in-range values untouched. Running them through the modulo below
    // perturbs them by floating point error - 174.7633 comes back as
    // 174.76329999999996 - which is physically irrelevant but would be displayed
    // in the UI and written back into the URL.
    if (longitude >= -180 && longitude <= 180) return longitude;

    const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;

    // The antimeridian is +/-180; prefer +180 over folding to -180.
    return wrapped === -180 ? 180 : wrapped;
}
