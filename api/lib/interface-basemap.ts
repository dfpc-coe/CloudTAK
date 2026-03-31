import { tileToBBOX } from './tilebelt.js';
import { bbox } from '@turf/bbox';
import { InferSelectModel } from 'drizzle-orm';
import type { BBox } from 'geojson';
import type { Response } from 'express';
import Config from './config.js';
import { Basemap } from './schema.js';
import { Static, Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Basemap_FeatureAction, Basemap_Protocol } from './enums.js';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { pointOnFeature } from '@turf/point-on-feature';
import { bboxPolygon } from '@turf/bbox-polygon';
import { Feature } from '@tak-ps/node-cot';
import { GeoJSONFeatureCollection, GeoJSONFeature } from './types.js';

export const TileJSONActions = Type.Object({
    feature: Type.Array(Type.Enum(Basemap_FeatureAction))
});

export const VectorLayer = Type.Object({
    id: Type.String(),
    fields: Type.Record(Type.String(), Type.String()),
    minzoom: Type.Optional(Type.Integer()),
    maxzoom: Type.Optional(Type.Integer()),
    description: Type.Optional(Type.String())
});

export const TileJSONType = Type.Object({
    tilejson: Type.Literal('3.0.0'),
    version: Type.String(),
    scheme: Type.Literal('xyz'),
    name: Type.String(),
    description: Type.String(),
    attribution: Type.Optional(Type.String()),
    // This is a custom attribute and not in the original TileJSON spec
    tileSize: Type.Optional(Type.Integer()),
    minzoom: Type.Integer(),
    maxzoom: Type.Integer(),
    tiles: Type.Array(Type.String()),
    bounds: Type.Tuple([Type.Number(), Type.Number(), Type.Number(), Type.Number()]),
    center: Type.Array(Type.Number()),
    type: Type.String(),
    format: Type.Optional(Type.String()),
    vector_layers: Type.Optional(Type.Array(VectorLayer))
});

export interface TileJSONInterface {
    name: string;
    url: string;
    description?: string;
    attribution: string | null | undefined;
    tilesize?: number;
    bounds?: Array<number>;
    center?: Array<number>;
    type?: string;
    version?: string;
    minzoom?: number;
    maxzoom?: number;
    vector_layers?: Array<Static<typeof VectorLayer>>;
}

export interface TileOpts {
    headers?: Record<string, string | undefined>;
}

/**
 * Generic interface for a basemap protocol implementation.
 */
export interface BasemapProtocolInterface {
    actions(): Static<typeof TileJSONActions>;
    isValidURL(str: string): void;

    tile(
        z: number, x: number, y: number,
        res: Response,
        opts?: TileOpts
    ): Promise<void>;

    featureQuery?(
        polygon: Static<typeof Feature.Polygon>
    ): Promise<Static<typeof GeoJSONFeatureCollection>>;

    featureFetch?(
        id: string
    ): Promise<Static<typeof GeoJSONFeature>>;
}

/**
 * @class
 *
 * Base class for all basemap protocol implementations. Provides shared utility
 * methods and a tile() facade that handles common pre-processing (header
 * normalisation and bounds checking) before delegating to the protocol-specific
 * _tile() implementation.
 */
export class BasemapProtocol implements BasemapProtocolInterface {
    basemap?: InferSelectModel<typeof Basemap>;

    constructor(basemap?: InferSelectModel<typeof Basemap>) {
        this.basemap = basemap;
    }

    /**
     * Validate a MapLibre Style JSON
     *
     * @param type   - Type of style (raster or vector)
     * @param layers - Array of style layers
     */
    static isValidStyle(type: string, layers: Array<unknown>): void {
        const sources: Record<string, unknown> = {};
        for (const l of layers as Array<Record<string, string>>) {
            if (!sources[l.source]) sources[l.source] = { type };
        }

        const errors = validateStyleMin({
            version: 8,
            glyphs: '/fonts/{fontstack}/{range}.pbf',
            sources: sources as any,
            layers: layers as any
        });

        if (errors.length) throw new Err(400, null, JSON.stringify(errors));
    }

    /**
     * Validate a basemap tile URL.
     * Subclasses override this to enforce protocol-specific URL patterns.
     * The base implementation only checks that the URL is well-formed and uses HTTP/S.
     *
     * @param str - Tile URL to validate
     */
    isValidURL(str: string): void {
        let url: URL;
        try {
            url = new URL(str);
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid URL provided');
        }

        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Err(400, null, 'Only HTTP and HTTPS Protocols are supported');
        }
    }

    /**
     * Determine the proxied tile URL to use when sharing this basemap.
     * ESRI-protocol basemaps route through the CloudTAK tile proxy; others
     * expose their URL directly.
     *
     * @param config - Application config
     */
    proxyShare(config: Config): string {
        const basemap = this.basemap!;

        if (!basemap.sharing_enabled) {
            throw new Err(400, null, `Basemap Sharing has been disabled for ${basemap.name}`);
        } else if (!basemap.sharing_token) {
            throw new Err(500, null, `Basemap with sharing has no token for ${basemap.id}`);
        }

        if (
            basemap.protocol === Basemap_Protocol.FeatureServer
            || basemap.protocol === Basemap_Protocol.MapServer
            || basemap.protocol === Basemap_Protocol.ImageServer
        ) {
            return `${config.API_URL}/api/basemap/${basemap.id}/tiles/{$z}/{$x}/{$y}?token=${basemap.sharing_token}`;
        }

        return basemap.url;
    }

    /**
     * Build a TileJSON 3.0.0 response object
     *
     * @param config - Basemap metadata
     */
    static json(config: TileJSONInterface): Static<typeof TileJSONType> {
        const bounds = (config.bounds as [number, number, number, number]) || [-180, -90, 180, 90];
        const center = config.center || pointOnFeature(bboxPolygon(bounds as BBox)).geometry.coordinates;
        const type = config.type || 'raster';
        const isVectorType = type !== 'raster' && type !== 'raster-dem';

        let vector_layers: Array<Static<typeof VectorLayer>> | undefined;
        if (isVectorType) {
            vector_layers = config.vector_layers
                ? [...config.vector_layers]
                : [{ id: 'out', fields: {} }];
        }

        return {
            tilejson: '3.0.0',
            version: config.version || '1.0.0',
            name: config.name,
            description: '',
            scheme: 'xyz',
            type,
            bounds,
            center,
            attribution: config.attribution || undefined,
            tileSize: config.tilesize,
            minzoom: config.minzoom ?? 0,
            maxzoom: config.maxzoom ?? 16,
            tiles: [String(config.url)],
            vector_layers
        };
    }

    /**
     * Convert ZXY tile coordinates to a WGS-84 bounding box
     *
     * @param z - Zoom level
     * @param x - Tile column
     * @param y - Tile row
     */
    static extent(z: number, x: number, y: number): Array<number> {
        return tileToBBOX([x, y, z]);
    }

    /**
     * Generate a Bing Maps style quadkey from ZXY tile coordinates
     *
     * @param z - Zoom level
     * @param x - Tile column
     * @param y - Tile row
     */
    static quadkey(z: number, x: number, y: number): string {
        const quadKey = [];
        for (let i = z; i > 0; i--) {
            let digit = 0;
            const mask = 1 << (i - 1);
            if ((x & mask) !== 0) digit++;
            if ((y & mask) !== 0) { digit++; digit++; }
            quadKey.push(digit);
        }
        return quadKey.join('');
    }

    /**
     * Return the feature actions supported by this protocol.
     * Subclasses that support feature querying should override this method.
     */
    actions(): Static<typeof TileJSONActions> {
        return {
            feature: []
        };
    }

    featureQuery?(
        polygon: Static<typeof Feature.Polygon>
    ): Promise<Static<typeof GeoJSONFeatureCollection>>;

    featureFetch?(
        id: string
    ): Promise<Static<typeof GeoJSONFeature>>;

    /**
     * Proxy a tile request to the upstream source.
     *
     * Handles common pre-processing (header normalisation and optional bounds
     * checking) before delegating to the protocol-specific _tile() method.
     */
    async tile(
        z: number, x: number, y: number,
        res: Response,
        opts?: TileOpts
    ): Promise<void> {
        const headers: Record<string, string | undefined> = { ...opts?.headers };
        for (const key of Object.keys(headers)) {
            if (!headers[key]) delete headers[key];
        }

        const bounds = this.basemap?.bounds ? bbox(this.basemap.bounds as any) : undefined;
        if (bounds && bounds.length === 4) {
            const tileBbox = tileToBBOX([x, y, z]);
            const [minLon, minLat, maxLon, maxLat] = bounds;
            const [tileMinLon, tileMinLat, tileMaxLon, tileMaxLat] = tileBbox;

            if (tileMaxLat < minLat || tileMinLat > maxLat) {
                res.status(404).send('Tile outside bounds');
                return;
            }

            const lonInBox = minLon <= maxLon
                ? tileMinLon <= maxLon && tileMaxLon >= minLon
                : tileMinLon <= maxLon || tileMaxLon >= minLon;

            if (!lonInBox) {
                res.status(404).send('Tile outside bounds');
                return;
            }
        }

        return this._tile(z, x, y, res, { headers });
    }

    protected async _tile(
        _z: number, _x: number, _y: number,
        _res: Response,
        _opts: Required<TileOpts>
    ): Promise<void> {
        throw new Err(501, null, 'Protocol does not implement tile()');
    }
}
