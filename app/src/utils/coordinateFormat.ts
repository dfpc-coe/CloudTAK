import { convert } from 'geo-coordinates-parser';

export type CoordMode = 'dd' | 'dm' | 'dms' | 'mgrs' | 'utm' | 'bng';

export type CoordBounds = [west: number, south: number, east: number, north: number];

export type CoordModeOption = {
    value: CoordMode;
    label: string;
    title: string;
    /** Extent the scheme is defined over - omitted when it covers the globe */
    bounds?: CoordBounds;
};

const UTM_BOUNDS: CoordBounds = [-180, -80, 180, 84];
const BNG_BOUNDS: CoordBounds = [-9.5, 49.76, 3.64, 61.59];

export const COORD_MODES: Array<CoordModeOption> = [
    { value: 'dd',   label: 'DD',   title: 'Decimal Degrees' },
    { value: 'dm',   label: 'DM',   title: 'Degrees Minutes' },
    { value: 'dms',  label: 'DMS',  title: 'Degrees Minutes Seconds' },
    { value: 'mgrs', label: 'MGRS', title: 'Military Grid Reference System', bounds: UTM_BOUNDS },
    { value: 'utm',  label: 'UTM',  title: 'Universal Transverse Mercator', bounds: UTM_BOUNDS },
    { value: 'bng',  label: 'BNG',  title: 'British National Grid', bounds: BNG_BOUNDS },
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
    } else if (mode === 'bng') {
        return asBNG(lat, lng);
    }
    return 'UNKNOWN';
}

/**
 * List the coordinate modes that are defined at a given location
 */
export function coordModesAt(lat: number, lng: number): Array<CoordModeOption> {
    return COORD_MODES.filter((mode) => {
        if (mode.bounds && !inBounds(lat, lng, mode.bounds)) return false;
        if (mode.value === 'bng') return bngGridRef(lat, lng) !== null;
        return true;
    });
}

/**
 * Resolve the mode to display a location in, falling back to the first
 * mode defined there when the preferred mode is not
 */
export function coordModeAt(preferred: CoordMode, lat: number, lng: number): CoordMode {
    const modes = coordModesAt(lat, lng);
    if (modes.some((mode) => mode.value === preferred)) return preferred;
    return modes[0].value;
}

function inBounds(lat: number, lng: number, bounds: CoordBounds): boolean {
    return lng >= bounds[0] && lat >= bounds[1] && lng <= bounds[2] && lat <= bounds[3];
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
    } else if (mode === 'bng') {
        return parseBNG(raw);
    } else if (mode === 'dd' || mode === 'dm' || mode === 'dms') {
        return parseDegrees(raw);
    }

    const parsers = [parseDegrees, parseUTM, parseMGRS, parseBNG];

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

type Ellipsoid = { a: number; b: number };
type Helmert = { tx: number; ty: number; tz: number; s: number; rx: number; ry: number; rz: number };

const WGS84: Ellipsoid = { a: 6378137, b: 6356752.314245 };
const AIRY1830: Ellipsoid = { a: 6377563.396, b: 6356256.909 };

// WGS84 => OSGB36: metres, ppm and arcseconds
const OSGB36_HELMERT: Helmert = {
    tx: -446.448, ty: 125.157, tz: -542.060,
    s: 20.4894,
    rx: -0.1502, ry: -0.2470, rz: -0.8421
};

const BNG_F0 = 0.9996012717;
const BNG_LAT0 = toRadians(49);
const BNG_LON0 = toRadians(-2);
const BNG_E0 = 400000;
const BNG_N0 = -100000;
const BNG_EXAMPLE = 'Expected BNG coordinates like "TQ 30080 80396"';

function asBNG(lat: number, lng: number): string {
    return bngGridRef(lat, lng) ?? 'Outside BNG area';
}

function bngGridRef(lat: number, lng: number): string | null {
    if (!inBounds(lat, lng, BNG_BOUNDS)) return null;

    const [osLat, osLng] = shiftDatum(lat, lng, WGS84, AIRY1830, OSGB36_HELMERT);
    const [easting, northing] = latLngToBNG(osLat, osLng);

    const e100km = Math.floor(easting / 100000);
    const n100km = Math.floor(northing / 100000);

    if (e100km < 0 || e100km > 6 || n100km < 0 || n100km > 12) return null;

    let l1 = (19 - n100km) - (19 - n100km) % 5 + Math.floor((e100km + 10) / 5);
    let l2 = (19 - n100km) * 5 % 25 + e100km % 5;

    // The grid lettering skips I
    if (l1 > 7) l1++;
    if (l2 > 7) l2++;

    const letters = String.fromCharCode(l1 + 65, l2 + 65);

    return `${letters} ${pad(Math.floor(easting % 100000))} ${pad(Math.floor(northing % 100000))}`;
}

function parseBNG(text: string): [number, number] {
    const compact = text.trim().toUpperCase();

    let easting: number;
    let northing: number;

    const numeric = compact.match(/^(\d{1,6}(?:\.\d+)?)\s*[,\s]\s*(\d{1,7}(?:\.\d+)?)$/);
    const lettered = compact.replace(/\s+/g, '').match(/^([HJNOST])([A-HJ-Z])(\d*)$/);

    if (numeric) {
        easting = Number(numeric[1]);
        northing = Number(numeric[2]);
    } else if (lettered) {
        const digits = lettered[3];

        if (digits.length % 2 !== 0 || digits.length > 10) {
            throw new Error(BNG_EXAMPLE);
        }

        let l1 = lettered[1].charCodeAt(0) - 65;
        let l2 = lettered[2].charCodeAt(0) - 65;

        if (l1 > 7) l1--;
        if (l2 > 7) l2--;

        const e100km = ((l1 - 2) % 5) * 5 + (l2 % 5);
        const n100km = (19 - Math.floor(l1 / 5) * 5) - Math.floor(l2 / 5);

        const half = digits.length / 2;

        easting = e100km * 100000 + Number(digits.slice(0, half).padEnd(5, '0'));
        northing = n100km * 100000 + Number(digits.slice(half).padEnd(5, '0'));
    } else {
        throw new Error(BNG_EXAMPLE);
    }

    if (easting < 0 || easting >= 700000 || northing < 0 || northing >= 1300000) {
        throw new Error('Coordinates are outside the British National Grid');
    }

    const [osLat, osLng] = bngToLatLng(easting, northing);

    return shiftDatum(osLat, osLng, AIRY1830, WGS84, invertHelmert(OSGB36_HELMERT));
}

function invertHelmert(t: Helmert): Helmert {
    return { tx: -t.tx, ty: -t.ty, tz: -t.tz, s: -t.s, rx: -t.rx, ry: -t.ry, rz: -t.rz };
}

function shiftDatum(lat: number, lng: number, from: Ellipsoid, to: Ellipsoid, t: Helmert): [number, number] {
    const latRad = toRadians(lat);
    const lngRad = toRadians(lng);

    const fromE2 = 1 - (from.b * from.b) / (from.a * from.a);
    const nu = from.a / Math.sqrt(1 - fromE2 * Math.pow(Math.sin(latRad), 2));

    const x1 = nu * Math.cos(latRad) * Math.cos(lngRad);
    const y1 = nu * Math.cos(latRad) * Math.sin(lngRad);
    const z1 = nu * (1 - fromE2) * Math.sin(latRad);

    const s = 1 + t.s / 1e6;
    const rx = toRadians(t.rx / 3600);
    const ry = toRadians(t.ry / 3600);
    const rz = toRadians(t.rz / 3600);

    const x2 = t.tx + x1 * s - y1 * rz + z1 * ry;
    const y2 = t.ty + x1 * rz + y1 * s - z1 * rx;
    const z2 = t.tz - x1 * ry + y1 * rx + z1 * s;

    const toE2 = 1 - (to.b * to.b) / (to.a * to.a);
    const p = Math.sqrt(x2 * x2 + y2 * y2);

    let phi = Math.atan2(z2, p * (1 - toE2));
    let previous = 2 * Math.PI;

    while (Math.abs(phi - previous) > 1e-12) {
        const toNu = to.a / Math.sqrt(1 - toE2 * Math.pow(Math.sin(phi), 2));
        previous = phi;
        phi = Math.atan2(z2 + toE2 * toNu * Math.sin(phi), p);
    }

    return [toDegrees(phi), toDegrees(Math.atan2(y2, x2))];
}

function bngMeridionalArc(phi: number): number {
    const { a, b } = AIRY1830;
    const n = (a - b) / (a + b);
    const n2 = n * n;
    const n3 = n2 * n;

    const dPhi = phi - BNG_LAT0;
    const sPhi = phi + BNG_LAT0;

    return b * BNG_F0 * (
        (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * dPhi
        - (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(dPhi) * Math.cos(sPhi)
        + ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * dPhi) * Math.cos(2 * sPhi)
        - (35 / 24) * n3 * Math.sin(3 * dPhi) * Math.cos(3 * sPhi)
    );
}

function bngRadii(phi: number): { nu: number; rho: number; eta2: number } {
    const { a, b } = AIRY1830;
    const e2 = 1 - (b * b) / (a * a);
    const sin2 = Math.pow(Math.sin(phi), 2);

    const nu = a * BNG_F0 / Math.sqrt(1 - e2 * sin2);
    const rho = a * BNG_F0 * (1 - e2) / Math.pow(1 - e2 * sin2, 1.5);

    return { nu, rho, eta2: nu / rho - 1 };
}

function latLngToBNG(lat: number, lng: number): [number, number] {
    const phi = toRadians(lat);
    const { nu, rho, eta2 } = bngRadii(phi);

    const sin = Math.sin(phi);
    const cos = Math.cos(phi);
    const cos3 = Math.pow(cos, 3);
    const cos5 = Math.pow(cos, 5);
    const tan2 = Math.pow(Math.tan(phi), 2);
    const tan4 = tan2 * tan2;

    const I = bngMeridionalArc(phi) + BNG_N0;
    const II = (nu / 2) * sin * cos;
    const III = (nu / 24) * sin * cos3 * (5 - tan2 + 9 * eta2);
    const IIIA = (nu / 720) * sin * cos5 * (61 - 58 * tan2 + tan4);
    const IV = nu * cos;
    const V = (nu / 6) * cos3 * (nu / rho - tan2);
    const VI = (nu / 120) * cos5 * (5 - 18 * tan2 + tan4 + 14 * eta2 - 58 * tan2 * eta2);

    const d = toRadians(lng) - BNG_LON0;

    return [
        BNG_E0 + IV * d + V * Math.pow(d, 3) + VI * Math.pow(d, 5),
        I + II * Math.pow(d, 2) + III * Math.pow(d, 4) + IIIA * Math.pow(d, 6)
    ];
}

function bngToLatLng(easting: number, northing: number): [number, number] {
    const a = AIRY1830.a;

    let phi = BNG_LAT0;
    let m = 0;

    do {
        phi = (northing - BNG_N0 - m) / (a * BNG_F0) + phi;
        m = bngMeridionalArc(phi);
    } while (Math.abs(northing - BNG_N0 - m) >= 0.00001);

    const { nu, rho, eta2 } = bngRadii(phi);

    const tan = Math.tan(phi);
    const tan2 = tan * tan;
    const tan4 = tan2 * tan2;
    const tan6 = tan4 * tan2;
    const sec = 1 / Math.cos(phi);

    const VII = tan / (2 * rho * nu);
    const VIII = tan / (24 * rho * Math.pow(nu, 3)) * (5 + 3 * tan2 + eta2 - 9 * tan2 * eta2);
    const IX = tan / (720 * rho * Math.pow(nu, 5)) * (61 + 90 * tan2 + 45 * tan4);
    const X = sec / nu;
    const XI = sec / (6 * Math.pow(nu, 3)) * (nu / rho + 2 * tan2);
    const XII = sec / (120 * Math.pow(nu, 5)) * (5 + 28 * tan2 + 24 * tan4);
    const XIIA = sec / (5040 * Math.pow(nu, 7)) * (61 + 662 * tan2 + 1320 * tan4 + 720 * tan6);

    const d = easting - BNG_E0;

    return [
        toDegrees(phi - VII * Math.pow(d, 2) + VIII * Math.pow(d, 4) - IX * Math.pow(d, 6)),
        toDegrees(BNG_LON0 + X * d - XI * Math.pow(d, 3) + XII * Math.pow(d, 5) - XIIA * Math.pow(d, 7))
    ];
}
