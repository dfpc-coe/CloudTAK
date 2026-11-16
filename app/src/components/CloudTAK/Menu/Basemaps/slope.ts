/**
 * Slope angle basemaps are rendered by the PMTiles service from an existing
 * raster-dem basemap. The classes live in the basemap (or profile overlay)
 * `args` map as repeatable `layer=lower:upper:hex` params, which the client
 * appends to every tile request.
 */

export type TileArgs = Record<string, string | string[]>;

export interface SlopeClass {
    lower: number;
    upper: number;
    /** #RRGGBB */
    color: string;
    /** 0-100 */
    opacity: number;
}

export interface SlopeSource {
    host: string;
    dem: number;
}

export const MAX_SLOPE_CLASSES = 16;

export const DEFAULT_SLOPE_CLASSES: SlopeClass[] = [
    { lower: 27, upper: 30, color: '#FFEB3B', opacity: 78 },
    { lower: 30, upper: 35, color: '#FF9800', opacity: 78 },
    { lower: 35, upper: 45, color: '#F44336', opacity: 78 },
    { lower: 45, upper: 50, color: '#9C27B0', opacity: 78 },
    { lower: 50, upper: 90, color: '#212121', opacity: 78 },
];

const TILE_PATTERN = /^(.*)\/tiles\/slope\/(\d+)\/tiles\/\{\$?z\}\/\{\$?x\}\/\{\$?y\}(?:\?.*)?$/;
const LAYER_PATTERN = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):#?([0-9a-f]{6}|[0-9a-f]{8})$/i;

export function cloneSlopeClasses(classes: SlopeClass[] = DEFAULT_SLOPE_CLASSES): SlopeClass[] {
    return classes.map((c) => ({ ...c }));
}

export function isSlopeURL(url?: string | null): boolean {
    return !!url && TILE_PATTERN.test(url);
}

export function parseSlopeSource(url?: string | null): SlopeSource | null {
    const match = url ? url.match(TILE_PATTERN) : null;
    if (!match) return null;

    return { host: match[1], dem: Number(match[2]) };
}

export function slopeTileURL(host: string, dem: number): string {
    return `${host}/tiles/slope/${dem}/tiles/{z}/{x}/{y}`;
}

export function slopeTileJSONURL(host: string, dem: number): string {
    return `${host}/tiles/slope/${dem}`;
}

export function parseSlopeLayer(value: string): SlopeClass | null {
    const match = value.match(LAYER_PATTERN);
    if (!match) return null;

    const lower = Number(match[1]);
    const upper = Number(match[2]);
    if (lower >= upper || upper > 90) return null;

    const hex = match[3];
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;

    return {
        lower,
        upper,
        color: `#${hex.slice(0, 6).toUpperCase()}`,
        opacity: Math.round(alpha / 255 * 100),
    };
}

export function serializeSlopeLayer(slope: SlopeClass): string {
    const alpha = Math.round(Math.min(100, Math.max(0, slope.opacity)) / 100 * 255);
    const hex = slope.color.replace(/^#/, '').toLowerCase().slice(0, 6);
    const suffix = alpha === 255 ? '' : alpha.toString(16).padStart(2, '0');
    return `${slope.lower}:${slope.upper}:${hex}${suffix}`;
}

export function validateSlopeClasses(classes: SlopeClass[]): string {
    if (!classes.length) return 'At least one slope class is required';
    if (classes.length > MAX_SLOPE_CLASSES) return `At most ${MAX_SLOPE_CLASSES} slope classes are allowed`;

    for (const slope of classes) {
        if (!Number.isFinite(slope.lower) || !Number.isFinite(slope.upper)) return 'Slope angles must be numbers';
        if (slope.lower < 0 || slope.upper > 90) return 'Slope angles must be between 0 and 90 degrees';
        if (slope.lower >= slope.upper) return 'Each slope class must have a lower angle below its upper angle';
        if (!/^#[0-9a-f]{6}$/i.test(slope.color)) return 'Slope colours must be #RRGGBB';
    }

    return '';
}

/** The `args` entry carrying these classes */
export function slopeArgs(classes: SlopeClass[]): TileArgs {
    return { layer: classes.map(serializeSlopeLayer) };
}

/** Classes from an `args` map, defaulting to the avalanche bands when none are valid */
export function parseSlopeArgs(args?: TileArgs | null): SlopeClass[] {
    const raw = args?.layer;
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

    const classes: SlopeClass[] = [];
    for (const value of values) {
        const slope = parseSlopeLayer(value);
        if (slope) classes.push(slope);
    }

    return classes.length ? classes : cloneSlopeClasses();
}
