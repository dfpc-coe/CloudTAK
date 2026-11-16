/**
 * Composite basemaps are flattened by the PMTiles service from an ordered
 * stack of raster basemaps. The spec travels on the tile and TileJSON URLs
 * as base64url JSON, so a stored basemap row needs nothing beyond its url
 * and tilejson fields. Limits mirror tasks/pmtiles/lib/composite.ts.
 */

export const BLEND_MODES = [
    'over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'hard-light', 'soft-light', 'difference', 'exclusion',
] as const;
export type BlendMode = typeof BLEND_MODES[number];

export const COMPOSITE_FORMATS = ['png', 'webp', 'jpeg'] as const;
export type CompositeFormat = typeof COMPOSITE_FORMATS[number];

export const MAX_LAYERS = 8;
export const MAX_SPEC_LENGTH = 4096;

export interface CompositeLayer {
    basemap: number;
    /** 0-1 */
    opacity: number;
    blend: BlendMode;
    greyscale: boolean;
    minzoom?: number;
    maxzoom?: number;
    /** Fields the editor does not expose but must preserve */
    [key: string]: unknown;
}

export interface CompositeSpec {
    tilesize: 256 | 512;
    format: CompositeFormat;
    layers: CompositeLayer[];
    [key: string]: unknown;
}

export interface CompositeSource {
    host: string;
    spec: CompositeSpec;
}

const TILE_PATTERN = /^(.*)\/tiles\/composite\/([A-Za-z0-9_-]+)\/tiles\/\{\$?z\}\/\{\$?x\}\/\{\$?y\}$/;

export function isCompositeURL(url?: string | null): boolean {
    return !!url && TILE_PATTERN.test(url);
}

export function encodeSpec(spec: CompositeSpec): string {
    const bytes = new TextEncoder().encode(JSON.stringify(spec));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSpec(encoded: string): CompositeSpec | null {
    try {
        const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const parsed = JSON.parse(new TextDecoder().decode(bytes));
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.layers)) return null;

        const layers = (parsed.layers as unknown[]).filter((layer): layer is Partial<CompositeLayer> & { basemap: number } => {
            return !!layer && typeof layer === 'object' && typeof (layer as { basemap?: unknown }).basemap === 'number';
        });
        if (layers.length !== parsed.layers.length) return null;

        return {
            ...parsed,
            tilesize: parsed.tilesize === 512 ? 512 : 256,
            format: COMPOSITE_FORMATS.includes(parsed.format) ? parsed.format : 'png',
            layers: layers.map((layer) => normalizeLayer(layer)),
        };
    } catch {
        return null;
    }
}

export function normalizeLayer(layer: Partial<CompositeLayer> & { basemap: number }): CompositeLayer {
    return {
        ...layer,
        basemap: layer.basemap,
        opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
        blend: BLEND_MODES.includes(layer.blend as BlendMode) ? layer.blend as BlendMode : 'over',
        greyscale: layer.greyscale === true,
    };
}

export function validateSpec(spec: CompositeSpec): string {
    if (!spec.layers.length) return 'Add at least one layer';
    if (spec.layers.length > MAX_LAYERS) return `At most ${MAX_LAYERS} layers can be composited`;

    for (const layer of spec.layers) {
        if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) return 'Layer opacity must be between 0 and 100%';
        if (layer.minzoom !== undefined && (layer.minzoom < 0 || layer.minzoom > 24)) return 'Layer zooms must be between 0 and 24';
        if (layer.maxzoom !== undefined && (layer.maxzoom < 0 || layer.maxzoom > 24)) return 'Layer zooms must be between 0 and 24';
        if (layer.minzoom !== undefined && layer.maxzoom !== undefined && layer.minzoom > layer.maxzoom) return 'A layer minzoom cannot exceed its maxzoom';
    }

    if (encodeSpec(spec).length > MAX_SPEC_LENGTH) return 'Composite definition is too long';

    return '';
}

export function compositeTileURL(host: string, spec: CompositeSpec): string {
    return `${host}/tiles/composite/${encodeSpec(spec)}/tiles/{z}/{x}/{y}`;
}

export function compositeTileJSONURL(host: string, spec: CompositeSpec): string {
    return `${host}/tiles/composite/${encodeSpec(spec)}`;
}

export function parseCompositeSource(url?: string | null): CompositeSource | null {
    const match = url ? url.match(TILE_PATTERN) : null;
    if (!match) return null;

    const spec = decodeSpec(match[2]);
    if (!spec) return null;

    return { host: match[1], spec };
}
