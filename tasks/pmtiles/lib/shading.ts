import type { Response } from 'express';
import sharp from 'sharp';
import Err from '@openaddresses/batch-error';
import type { Static } from '@sinclair/typebox';
import type { ElevationEncoding } from './elevation.js';
import type { TileJSON_Legend } from './tilejson.js';

const EARTH_CIRCUMFERENCE = 40075016.686;

/** Parent zoom levels walked up when the DEM has no tile at the requested zoom */
export const MAX_OVERZOOM = 4;

export type RGBA = [number, number, number, number];

/** A slope angle band coloured as [lower, upper) degrees */
export interface SlopeClass {
    lower: number;
    upper: number;
    color: RGBA;
}

export const MAX_SLOPE_CLASSES = 16;

/** Avalanche slope angle classes used when a request supplies none */
export const DEFAULT_SLOPE_CLASSES: SlopeClass[] = [
    { lower: 27, upper: 30, color: [255, 235, 59, 200] },
    { lower: 30, upper: 35, color: [255, 152, 0, 200] },
    { lower: 35, upper: 45, color: [244, 67, 54, 200] },
    { lower: 45, upper: 50, color: [156, 39, 176, 200] },
    { lower: 50, upper: 90, color: [33, 33, 33, 200] },
];

const LAYER_PATTERN = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?):#?([0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Parse `layer` query values of the form lower:upper:hex_color, where the
 * colour is RRGGBB or RRGGBBAA. No values means the default classes.
 */
export function parseSlopeLayers(raw: string | string[] | undefined): SlopeClass[] {
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    if (!values.length) return DEFAULT_SLOPE_CLASSES;

    if (values.length > MAX_SLOPE_CLASSES) {
        throw new Err(400, null, `At most ${MAX_SLOPE_CLASSES} slope layers are allowed`);
    }

    return values.map((value) => {
        const match = value.match(LAYER_PATTERN);
        if (!match) {
            throw new Err(400, null, `Invalid slope layer "${value}": expected lower:upper:hex_color`);
        }

        const lower = Number(match[1]);
        const upper = Number(match[2]);
        if (lower >= upper || upper > 90) {
            throw new Err(400, null, `Invalid slope layer "${value}": expected 0 <= lower < upper <= 90`);
        }

        const hex = match[3];
        const color: RGBA = [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
            hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255,
        ];

        return { lower, upper, color };
    });
}

/** Normalised `layer` query values for a tile URL template */
export function serializeSlopeLayers(classes: SlopeClass[]): string[] {
    return classes.map(({ lower, upper, color }) => {
        const hex = color.slice(0, color[3] === 255 ? 3 : 4).map(c => c.toString(16).padStart(2, '0')).join('');
        return `${lower}:${upper}:${hex}`;
    });
}

export interface DEM {
    size: number;
    elevation: Float32Array;
}

export type DEMTileFetch = (z: number, x: number, y: number) => Promise<ArrayBuffer | Uint8Array | null>;

/** A raster-dem tile source the shading renderers read from */
export interface DEMSource {
    encoding: ElevationEncoding;
    minzoom: number;
    maxzoom: number;
    tile: DEMTileFetch;
}

export function slopeLegend(classes: SlopeClass[] = DEFAULT_SLOPE_CLASSES): Static<typeof TileJSON_Legend> {
    return classes.map(({ lower, upper, color: [r, g, b, a] }) => ({
        label: upper >= 90 ? `${lower}°+` : `${lower}-${upper}°`,
        color: `rgba(${r}, ${g}, ${b}, ${Math.round(a / 255 * 100) / 100})`,
    }));
}

export function decode(data: Uint8Array, channels: number, size: number, encoding: ElevationEncoding): Float32Array {
    const elevation = new Float32Array(size * size);

    for (let i = 0; i < elevation.length; i++) {
        const r = data[i * channels];
        const g = data[i * channels + 1];
        const b = data[i * channels + 2];

        elevation[i] = encoding === 'terrarium'
            ? (r * 256 + g + b / 256) - 32768
            : -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
    }

    return elevation;
}

/**
 * Slope in degrees for every pixel using Horn's method, with edge pixels clamped
 */
export function slope(dem: DEM, z: number, y: number): Float32Array {
    const { size, elevation } = dem;
    const slope = new Float32Array(size * size);

    const at = (px: number, py: number): number => {
        return elevation[Math.min(Math.max(py, 0), size - 1) * size + Math.min(Math.max(px, 0), size - 1)];
    };

    for (let py = 0; py < size; py++) {
        const n = Math.PI - (2 * Math.PI * (y + (py + 0.5) / size)) / 2 ** z;
        const lat = Math.atan(Math.sinh(n));
        const cell = (EARTH_CIRCUMFERENCE * Math.cos(lat)) / (2 ** z * size);

        for (let px = 0; px < size; px++) {
            const a = at(px - 1, py - 1), b = at(px, py - 1), c = at(px + 1, py - 1);
            const d = at(px - 1, py), f = at(px + 1, py);
            const g = at(px - 1, py + 1), h = at(px, py + 1), i = at(px + 1, py + 1);

            const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cell);
            const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * cell);

            slope[py * size + px] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI;
        }
    }

    return slope;
}

/** Colour each pixel by the first class whose [lower, upper) band contains its slope */
export function colorize(slope: Float32Array, classes: SlopeClass[] = DEFAULT_SLOPE_CLASSES): Buffer {
    const rgba = Buffer.alloc(slope.length * 4);

    for (let i = 0; i < slope.length; i++) {
        for (const { lower, upper, color } of classes) {
            if (slope[i] >= lower && slope[i] < upper) {
                rgba.set(color, i * 4);
                break;
            }
        }
    }

    return rgba;
}

/**
 * Bilinearly resample the quadrant of a parent DEM covering a tile dz levels below it
 */
export function upsample(parent: DEM, dz: number, x: number, y: number): DEM {
    const { size } = parent;
    const scale = 2 ** dz;
    const elevation = new Float32Array(size * size);

    const at = (px: number, py: number): number => {
        return parent.elevation[Math.min(Math.max(py, 0), size - 1) * size + Math.min(Math.max(px, 0), size - 1)];
    };

    for (let py = 0; py < size; py++) {
        const sy = ((y % scale) + (py + 0.5) / size) * size / scale - 0.5;
        const y0 = Math.floor(sy);
        const fy = sy - y0;

        for (let px = 0; px < size; px++) {
            const sx = ((x % scale) + (px + 0.5) / size) * size / scale - 0.5;
            const x0 = Math.floor(sx);
            const fx = sx - x0;

            elevation[py * size + px] = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy)
                + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
        }
    }

    return { size, elevation };
}

/**
 * Read the DEM for a tile, upsampling a parent tile when the source has no data at this zoom
 */
export async function fetchDEM(z: number, x: number, y: number, source: DEMSource): Promise<DEM | null> {
    for (let dz = 0; dz <= MAX_OVERZOOM && dz <= z; dz++) {
        const pz = z - dz;
        if (pz > source.maxzoom) continue;
        if (pz < source.minzoom) break;

        const raw = await source.tile(pz, x >> dz, y >> dz);
        if (!raw) continue;

        let image;
        try {
            image = await sharp(Buffer.from(raw as Uint8Array))
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'DEM tile is not a supported raster image');
        }

        if (image.info.width !== image.info.height) throw new Err(400, null, 'DEM tiles must be square');

        const dem = {
            size: image.info.width,
            elevation: decode(image.data, image.info.channels, image.info.width, source.encoding),
        };

        return dz === 0 ? dem : upsample(dem, dz, x, y);
    }

    return null;
}

/**
 * Render slope angle classes for a tile as a transparent PNG, or null when the source has no DEM there
 */
export async function renderSlopeTile(
    z: number, x: number, y: number,
    source: DEMSource,
    classes: SlopeClass[] = DEFAULT_SLOPE_CLASSES,
): Promise<Buffer | null> {
    const dem = await fetchDEM(z, x, y, source);
    if (!dem) return null;

    return await sharp(colorize(slope(dem, z, y), classes), {
        raw: { width: dem.size, height: dem.size, channels: 4 },
    }).png({ palette: true }).toBuffer();
}

export function sendShadingTile(res: Response, png: Buffer | null): void {
    if (!png) {
        res.status(204).send('');
        return;
    }

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, max-age=86400');
    res.send(png);
}
