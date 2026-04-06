import { convert } from 'geo-coordinates-parser';

export type CoordMode = 'dd' | 'dm' | 'dms' | 'mgrs' | 'utm';

export const COORD_MODES: Array<{ value: CoordMode; label: string; title: string }> = [
    { value: 'dd',   label: 'DD',   title: 'Decimal Degrees' },
    { value: 'dm',   label: 'DM',   title: 'Degrees Minutes' },
    { value: 'dms',  label: 'DMS',  title: 'Degrees Minutes Seconds' },
    { value: 'mgrs', label: 'MGRS', title: 'Military Grid Reference System' },
    { value: 'utm',  label: 'UTM',  title: 'Universal Transverse Mercator' },
];

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

function parseDegrees(text: string): [number, number] {
    try {
        const parsed = convert(text);

        return [parsed.decimalLatitude, parsed.decimalLongitude];
    } catch {
        throw new Error('Expected a valid decimal, DM, or DMS coordinate pair');
    }
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
