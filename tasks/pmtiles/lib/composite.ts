import { createHash } from 'node:crypto';
import Err from '@openaddresses/batch-error';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import sharp from 'sharp';
import type { TileBuffer } from './basemap/protocol.js';

export const BLEND_MODES = [
    'over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'hard-light', 'soft-light', 'difference', 'exclusion',
] as const;
export type BlendMode = typeof BLEND_MODES[number];

export const COMPOSITE_FORMATS = ['png', 'webp', 'jpeg'] as const;
export type CompositeFormat = typeof COMPOSITE_FORMATS[number];

/** Parent zoom levels walked up when a layer source stops short of the requested zoom */
export const MAX_OVERZOOM = 4;
export const MAX_LAYERS = 8;
export const MAX_SPEC_LENGTH = 4096;
export const CACHE_CONTROL = 'private, max-age=86400';

const Channel = Type.Integer({ minimum: 0, maximum: 255 });

export const CompositeLayer = Type.Object({
    basemap: Type.Integer({ minimum: 1, description: 'Raster basemap rendered by this layer' }),
    opacity: Type.Number({ minimum: 0, maximum: 1, default: 1 }),
    blend: Type.Union(BLEND_MODES.map(mode => Type.Literal(mode)), {
        default: 'over',
        description: 'How the layer blends with the layers below it',
    }),
    minzoom: Type.Optional(Type.Integer({ minimum: 0, maximum: 24, description: 'Hide the layer below this zoom' })),
    maxzoom: Type.Optional(Type.Integer({ minimum: 0, maximum: 24, description: 'Hide the layer above this zoom' })),
    greyscale: Type.Boolean({ default: false }),
    modulate: Type.Optional(Type.Object({
        brightness: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
        saturation: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
        hue: Type.Optional(Type.Integer({ minimum: -360, maximum: 360 })),
    })),
    transparent: Type.Optional(Type.Object({
        color: Type.Tuple([Channel, Channel, Channel]),
        tolerance: Type.Integer({ minimum: 0, maximum: 255, default: 0 }),
    }, { description: 'Pixels within tolerance of this RGB colour become fully transparent' })),
});

export const CompositeSpec = Type.Object({
    tilesize: Type.Union([Type.Literal(256), Type.Literal(512)], { default: 256 }),
    format: Type.Union(COMPOSITE_FORMATS.map(format => Type.Literal(format)), { default: 'png' }),
    background: Type.Tuple([Channel, Channel, Channel, Channel], { default: [0, 0, 0, 0] }),
    layers: Type.Array(CompositeLayer, { minItems: 1, maxItems: MAX_LAYERS }),
});

export type CompositeSpecType = Static<typeof CompositeSpec>;
export type CompositeLayerType = Static<typeof CompositeLayer>;

/** A tile source backing one composite layer */
export interface CompositeSource {
    minzoom: number;
    maxzoom: number;
    tile: (z: number, x: number, y: number) => Promise<TileBuffer | null>;
}

/** Validate a spec and fill defaults without mutating the input */
export function validateSpec(input: unknown): CompositeSpecType {
    const spec = Value.Default(CompositeSpec, Value.Clone(input));

    if (!Value.Check(CompositeSpec, spec)) {
        const error = Value.Errors(CompositeSpec, spec).First();
        throw new Err(400, null, `Invalid composite: ${error ? `${error.path || '/'} ${error.message}` : 'schema mismatch'}`);
    }

    for (const layer of spec.layers) {
        if (layer.minzoom !== undefined && layer.maxzoom !== undefined && layer.minzoom > layer.maxzoom) {
            throw new Err(400, null, `Invalid composite: layer ${layer.basemap} minzoom exceeds maxzoom`);
        }
    }

    return spec;
}

export function encodeSpec(spec: unknown): string {
    return Buffer.from(JSON.stringify(spec)).toString('base64url');
}

export function decodeSpec(encoded: string): CompositeSpecType {
    if (encoded.length > MAX_SPEC_LENGTH) throw new Err(400, null, 'Composite spec too long');

    let parsed: unknown;
    try {
        parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
        throw new Err(400, null, 'Composite spec is not base64url encoded JSON');
    }

    return validateSpec(parsed);
}

function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;

    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => {
            return `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`;
        }).join(',')}}`;
    }

    return JSON.stringify(value) ?? 'null';
}

/** Stable digest of a spec plus anything else that identifies the rendered output */
export function specHash(spec: CompositeSpecType, extra: unknown[] = []): string {
    return createHash('sha256').update(canonical([spec, ...extra])).digest('hex').slice(0, 32);
}

export function compositeContentType(format: CompositeFormat): string {
    return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

/**
 * Fetch one layer as tilesize RGBA raw pixels, extracting and upscaling a parent
 * quadrant when the source has no tiles at the requested zoom
 */
async function fetchLayer(
    z: number, x: number, y: number,
    layer: CompositeLayerType,
    source: CompositeSource,
    tilesize: number,
): Promise<Buffer | null> {
    if (layer.minzoom !== undefined && z < layer.minzoom) return null;
    if (layer.maxzoom !== undefined && z > layer.maxzoom) return null;
    if (z < source.minzoom) return null;

    const dz = Math.max(0, z - source.maxzoom);
    if (dz > MAX_OVERZOOM) return null;

    const tile = await source.tile(z - dz, x >> dz, y >> dz);
    if (!tile) return null;

    let raw: Buffer;
    try {
        let image = sharp(tile.data);

        if (dz > 0) {
            const meta = await image.metadata();
            const scale = 2 ** dz;
            const size = Math.floor((meta.width ?? 0) / scale);
            if (size < 1) return null;

            image = image.extract({
                left: (x % scale) * size,
                top: (y % scale) * size,
                width: size,
                height: size,
            });
        }

        image = image
            .resize(tilesize, tilesize, { kernel: dz > 0 ? 'cubic' : 'lanczos3' })
            .ensureAlpha();

        if (layer.modulate) image = image.modulate(layer.modulate);

        raw = await image.raw().toBuffer();
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : new Error(String(err)), `Layer ${layer.basemap} tile is not a supported raster image`);
    }

    if (raw.length !== tilesize * tilesize * 4) {
        throw new Err(500, null, `Layer ${layer.basemap} decoded to ${raw.length} bytes, expected ${tilesize * tilesize * 4}`);
    }

    if (layer.greyscale) {
        for (let i = 0; i < raw.length; i += 4) {
            const luma = Math.round(0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2]);
            raw[i] = luma;
            raw[i + 1] = luma;
            raw[i + 2] = luma;
        }
    }

    if (layer.transparent) {
        const [kr, kg, kb] = layer.transparent.color;
        const tolerance = layer.transparent.tolerance;

        for (let i = 0; i < raw.length; i += 4) {
            if (
                Math.abs(raw[i] - kr) <= tolerance
                && Math.abs(raw[i + 1] - kg) <= tolerance
                && Math.abs(raw[i + 2] - kb) <= tolerance
            ) {
                raw[i + 3] = 0;
            }
        }
    }

    if (layer.opacity < 1) {
        for (let i = 3; i < raw.length; i += 4) {
            raw[i] = Math.round(raw[i] * layer.opacity);
        }
    }

    return raw;
}

/**
 * Render a composite tile, or null when no layer has data at this location
 */
export async function renderComposite(
    z: number, x: number, y: number,
    spec: CompositeSpecType,
    sources: CompositeSource[],
): Promise<Buffer | null> {
    if (sources.length !== spec.layers.length) {
        throw new Err(500, null, 'Composite sources do not match layers');
    }

    const results = await Promise.all(spec.layers.map((layer, i) => {
        return fetchLayer(z, x, y, layer, sources[i], spec.tilesize);
    }));

    const layers = results.flatMap((data, i) => data ? [{ data, blend: spec.layers[i].blend }] : []);
    if (!layers.length) return null;

    const [r, g, b, a] = spec.background;
    const alpha = spec.format === 'jpeg' ? 1 : a / 255;

    const image = sharp({
        create: { width: spec.tilesize, height: spec.tilesize, channels: 4, background: { r, g, b, alpha } },
    }).composite(layers.map(layer => ({
        input: layer.data,
        raw: { width: spec.tilesize, height: spec.tilesize, channels: 4 },
        blend: layer.blend,
    })));

    switch (spec.format) {
        case 'webp': return await image.webp().toBuffer();
        case 'jpeg': return await image.jpeg().toBuffer();
        default: return await image.png().toBuffer();
    }
}
