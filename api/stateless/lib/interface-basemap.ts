import { InferSelectModel } from 'drizzle-orm';
import type { BBox } from 'geojson';
import Config from '../../common/config.js';
import { Basemap } from '../../common/schema.js';
import { Static, Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { Basemap_FeatureAction, Basemap_Protocol } from '../../common/enums.js';
import { StyleSpecification, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import pointOnFeature from '@turf/point-on-feature';
import { bboxPolygon } from '@turf/bbox-polygon';
import { Feature } from '@tak-ps/node-cot';
import { MultiGeoJSONFeatureCollection, MultiGeoJSONFeature, TileJSON, TileJSON_VectorLayer } from '../../common/types.js';
import BasemapControl from '../../common/control/basemap.js';

export const TileJSONActions = Type.Object({
    feature: Type.Array(Type.Enum(Basemap_FeatureAction)),
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
    vector_layers?: Array<Static<typeof TileJSON_VectorLayer>>;
}

/**
 * Generic interface for a basemap protocol implementation.
 */
export interface BasemapProtocolInterface {
    actions(): Static<typeof TileJSONActions>;
    isValidURL(str: string): void;

    featureQuery?(
        polygon: Static<typeof Feature.Polygon>
    ): Promise<Static<typeof MultiGeoJSONFeatureCollection>>;

    featureFetch?(
        id: string
    ): Promise<Static<typeof MultiGeoJSONFeature>>;
}

/**
 * @class
 *
 * Base class for all basemap protocol implementations - URL validation,
 * TileJSON construction and feature actions. Tiles are served by the PMTiles
 * tile server
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
            sources: sources as StyleSpecification['sources'],
            layers: layers as StyleSpecification['layers'],
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
            || basemap.protocol === Basemap_Protocol.Hosted
        ) {
            const shared = BasemapControl.applyTileArgs(`${config.BASEMAP_TILES_URL}/${basemap.id}/tiles/{$z}/{$x}/{$y}`, basemap.args);
            return `${shared}${shared.includes('?') ? '&' : '?'}token=${basemap.sharing_token}`;
        }

        return BasemapControl.applyTileArgs(basemap.url, basemap.args);
    }

    /**
     * Build a TileJSON 3.0.0 response object
     *
     * @param config - Basemap metadata
     */
    static json(config: TileJSONInterface): Static<typeof TileJSON> {
        const bounds = (config.bounds as [number, number, number, number]) || [-180, -90, 180, 90];

        // TileJSON 3.0.0 centers are [longitude, latitude, zoom]
        const lonlat = config.center && config.center.length >= 2
            ? config.center.slice(0, 2)
            : pointOnFeature(bboxPolygon(bounds as BBox)).geometry.coordinates;
        const zoom = config.center && config.center.length >= 3
            ? config.center[2]
            : Math.round(((config.minzoom ?? 0) + (config.maxzoom ?? 16)) / 2);
        const center = [...lonlat, zoom];

        const type = config.type || 'raster';
        const isVectorType = type !== 'raster' && type !== 'raster-dem';

        let vector_layers: Array<Static<typeof TileJSON_VectorLayer>> | undefined;
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
            vector_layers,
        };
    }

    /**
     * Return the feature actions supported by this protocol.
     * Subclasses that support feature querying should override this method.
     */
    actions(): Static<typeof TileJSONActions> {
        return {
            feature: [],
        };
    }

    featureQuery?(
        polygon: Static<typeof Feature.Polygon>
    ): Promise<Static<typeof MultiGeoJSONFeatureCollection>>;

    featureFetch?(
        id: string
    ): Promise<Static<typeof MultiGeoJSONFeature>>;
}
