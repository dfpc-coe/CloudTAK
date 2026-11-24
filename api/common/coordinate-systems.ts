import fs from 'node:fs';
import { Type, type Static } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import proj4 from 'proj4';
import { Profile_Coordinate } from './enums.js';

/**
 * Additional coordinate reference systems an operator can offer next to the
 * built-in coordinate formats (DD, DM, DMS, MGRS, UTM).
 *
 * The systems are read from a JSON file so another operator or CloudTAK
 * instance can swap it out. The default lives in `api/config/coordinate-systems.json`;
 * set CLOUDTAK_COORDINATE_SYSTEMS_FILE to use a different file.
 *
 * Field names follow the `coordinateReferenceSystems` XML used by other TAK
 * tooling, so a file from there converts one-to-one. Only projected systems
 * (easting / northing in metres) are supported.
 */
export const CoordinateSystemBounds = Type.Object({
    minLongitude: Type.Number({ minimum: -180, maximum: 180 }),
    minLatitude: Type.Number({ minimum: -90, maximum: 90 }),
    maxLongitude: Type.Number({ minimum: -180, maximum: 180 }),
    maxLatitude: Type.Number({ minimum: -90, maximum: 90 }),
}, {
    description: 'Area of use. A maxLongitude lower than minLongitude means the area crosses the antimeridian',
});

export const CoordinateSystemFile = Type.Object({
    crs: Type.Array(Type.Object({
        name: Type.String({ minLength: 1, description: 'Short name, stored in profiles and shown on the unit tabs' }),
        title: Type.String({ minLength: 1, description: 'Full name shown in the settings' }),
        epsg: Type.Optional(Type.Integer({ description: 'EPSG code, used to look up a built-in definition' })),
        proj4: Type.Optional(Type.String({ description: 'proj4 definition, takes precedence over the EPSG code' })),
        bounds: CoordinateSystemBounds,
    })),
});

export const CoordinateSystem = Type.Object({
    name: Type.String(),
    title: Type.String(),
    epsg: Type.Optional(Type.Integer()),
    proj4: Type.String({ description: 'proj4 definition of the projected system' }),
    bounds: CoordinateSystemBounds,
});

export type CoordinateSystemType = Static<typeof CoordinateSystem>;

/** proj4 definitions for EPSG codes that can be referenced without a `proj4` field */
export const KNOWN_EPSG: Record<number, string> = {
    2193: '+proj=tmerc +lat_0=0 +lon_0=173 +k=0.9996 +x_0=1600000 +y_0=10000000 +ellps=GRS80 +units=m +no_defs',
};

const BUILTIN_NAMES = new Set<string>(Object.values(Profile_Coordinate).map((mode) => mode.toLowerCase()));
const validateFile = TypeCompiler.Compile(CoordinateSystemFile);

function defaultFile(): URL {
    return new URL('../config/coordinate-systems.json', import.meta.url);
}

/**
 * Parse and validate a coordinate system file. Invalid entries are skipped and
 * logged so a bad file can never take the settings pages down.
 */
export function parseCoordinateSystems(raw: string): Array<CoordinateSystemType> {
    const parsed: unknown = JSON.parse(raw);

    if (!validateFile.Check(parsed)) {
        throw new Error(`Invalid coordinate system file: ${JSON.stringify(validateFile.Errors(parsed).First())}`);
    }

    const systems: Array<CoordinateSystemType> = [];
    const seen = new Set<string>();

    for (const crs of parsed.crs) {
        try {
            const key = crs.name.toLowerCase();
            if (BUILTIN_NAMES.has(key)) throw new Error('name clashes with a built-in coordinate format');
            if (seen.has(key)) throw new Error('duplicate name');

            const definition = crs.proj4 ?? (crs.epsg !== undefined ? KNOWN_EPSG[crs.epsg] : undefined);
            if (!definition) throw new Error('needs a "proj4" definition or a known "epsg" code');

            const { minLongitude, maxLongitude, minLatitude, maxLatitude } = crs.bounds;
            if (minLatitude > maxLatitude) throw new Error('minLatitude is greater than maxLatitude');

            // Must project the middle of the area of use to finite numbers
            const centre = [
                maxLongitude >= minLongitude
                    ? (minLongitude + maxLongitude) / 2
                    : ((minLongitude + maxLongitude + 360) / 2 + 180) % 360 - 180,
                (minLatitude + maxLatitude) / 2,
            ];
            const [east, north] = proj4('EPSG:4326', definition).forward(centre);
            if (!Number.isFinite(east) || !Number.isFinite(north)) throw new Error('definition does not project its own area of use');

            seen.add(key);
            systems.push({
                name: crs.name,
                title: crs.title,
                epsg: crs.epsg,
                proj4: definition,
                bounds: crs.bounds,
            });
        } catch (err) {
            console.error(`Ignoring coordinate system "${crs.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return systems;
}

let cached: Array<CoordinateSystemType> | undefined;

/** Coordinate systems from the configured file, loaded once per process */
export function coordinateSystems(): Array<CoordinateSystemType> {
    if (cached) return cached;

    const file = process.env.CLOUDTAK_COORDINATE_SYSTEMS_FILE;
    try {
        cached = parseCoordinateSystems(String(fs.readFileSync(file ? file : defaultFile())));
    } catch (err) {
        console.error(`Unable to load coordinate systems from ${file || defaultFile().pathname}: ${err instanceof Error ? err.message : String(err)}`);
        cached = [];
    }

    return cached;
}

/** For tests, so a different file can be picked up */
export function resetCoordinateSystems(): void {
    cached = undefined;
}

/** All values a user can choose as their coordinate format */
export function coordinateModes(): Array<string> {
    return [
        ...Object.values(Profile_Coordinate) as Array<string>,
        ...coordinateSystems().map((crs) => crs.name),
    ];
}

export function isCoordinateMode(value: string): boolean {
    return coordinateModes().includes(value);
}
