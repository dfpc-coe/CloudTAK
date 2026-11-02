import Err from '@openaddresses/batch-error';
import type { Response } from 'express';
import type { Static } from '@sinclair/typebox';
import type { paths } from '@cloudtak/api-types';
import type { LineString } from 'geojson';
import { fetch, isSafeUrl } from '@tak-ps/node-safeurl';
import type { Auth } from './auth.js';
import getElevationProfile, { ElevationProfile } from './elevation.js';
import { TileJSON, TileJSONActions } from './tilejson.js';
import { EsriBase, EsriProxyLayer, isEsriLayerURL } from './esri.js';
import { BasemapProtocol, TileOpts } from './basemap/protocol.js';
import { fromProtocol } from './basemap/factory.js';

export type BasemapConfig = Exclude<paths['/api/basemap/{:basemapid}']['get']['responses'][200]['content']['application/json'], string>;

/**
 * A CloudTAK Basemap as seen by the tile server.
 *
 * Config is fetched from the CloudTAK API and held in module scope so a warm
 * Lambda container serves subsequent tiles without a round trip. Expiry is
 * compared at request time as no timers run between invocations.
 */
export default class Basemap {
    static CONFIG_TTL_MS = 60 * 1000;

    static #cache = new Map<number, { basemap: Basemap; fetched: number }>();

    readonly config: BasemapConfig;

    #protocol?: BasemapProtocol;

    constructor(config: BasemapConfig) {
        this.config = config;
    }

    static clearCache(): void {
        Basemap.#cache.clear();
    }

    static apiUrl(): string {
        return process.env.API_URL || 'http://localhost:5001';
    }

    static pmtilesUrl(): string {
        return process.env.PMTILES_URL || 'http://localhost:5002';
    }

    /**
     * Load a Basemap by ID, serving from the per-container cache when fresh.
     * The caller's token is forwarded so the API applies its own permission checks.
     */
    static async from(id: number, token: string): Promise<Basemap> {
        const cached = Basemap.#cache.get(id);
        if (cached && Date.now() - cached.fetched < Basemap.CONFIG_TTL_MS) return cached.basemap;

        const apiUrl = Basemap.apiUrl();
        const url = new URL(`/api/basemap/${id}`, apiUrl);
        url.searchParams.set('token', token);

        const res = await fetch(url, { safeUrlAllow: [apiUrl] });

        if (!res.ok) {
            let message = `CloudTAK API request failed with status ${res.status}`;

            try {
                const body = await res.json() as { message?: string };
                if (body.message) message = body.message;
            } catch {
                // Use the default message if the upstream body is not JSON.
            }

            throw new Err(res.status, null, message);
        }

        const basemap = new Basemap(await res.json() as BasemapConfig);
        Basemap.#cache.set(id, { basemap, fetched: Date.now() });

        return basemap;
    }

    get id(): number {
        return this.config.id;
    }

    /** True when tiles are served directly by the PMTiles host rather than proxied */
    get hosted(): boolean {
        return this.config.url.includes(new URL(Basemap.pmtilesUrl()).hostname);
    }

    /**
     * Users may read server basemaps and their own; admins may read any.
     * Sharing tokens may read only while sharing stays enabled and the token is current.
     */
    authorize(auth: Auth): void {
        if (auth.kind === 'user') {
            if (this.config.username && this.config.username !== auth.email && auth.access === 'user') {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }
        } else {
            if (this.config.sharing_enabled === false) {
                throw new Err(400, null, `Sharing for ${this.config.name} is disabled`);
            } else if (this.config.sharing_token !== auth.token) {
                throw new Err(400, null, 'You don\'t have permission to access this resource');
            }
        }
    }

    protocol(): BasemapProtocol {
        if (!this.#protocol) this.#protocol = fromProtocol(this.config);
        return this.#protocol;
    }

    actions(): Static<typeof TileJSONActions> {
        return this.protocol().actions();
    }

    /** Tile URL template pointing at this server, or at the PMTiles host for hosted basemaps */
    tileURL(token?: string): string {
        const url = this.hosted
            ? this.config.url
            : `${Basemap.pmtilesUrl()}/tiles/basemap/${this.id}/tiles/{z}/{x}/{y}`;

        return token ? `${url}?token=${token}` : url;
    }

    /**
     * Resolve the TileJSON, mirroring the CloudTAK API basemapTileJSON.
     * `token` is interpolated into tile URLs; omit it for a token-free document
     * the client can persist. `upstreamToken` authenticates metadata fetches
     * against the hosted PMTiles server.
     */
    async tilejson(opts: {
        token?: string;
        upstreamToken: string;
    }): Promise<Static<typeof TileJSON>> {
        const config = this.config;
        const tileURL = this.tileURL(opts.token);

        const esriMetadataURL = config.tilejson || config.url;

        if (isEsriLayerURL(esriMetadataURL)) {
            const layer = new EsriProxyLayer(new EsriBase(new URL(esriMetadataURL)));
            const metadata = await layer.tilejson();

            return BasemapProtocol.json({
                ...config,
                ...metadata,
                type: config.type,
                minzoom: config.minzoom ?? metadata.minzoom,
                maxzoom: config.maxzoom ?? metadata.maxzoom,
                bounds: config.bounds ?? metadata.bounds,
                center: config.center ?? metadata.center,
                url: tileURL,
            });
        }

        if (config.tilejson && (config.tilejson.startsWith('http://') || config.tilejson.startsWith('https://'))) {
            const url = new URL(config.tilejson);

            if (url.hostname === new URL(Basemap.pmtilesUrl()).hostname) {
                url.searchParams.set('token', opts.upstreamToken);
            } else if (process.env.StackName !== 'test') {
                const { safe, reason } = await isSafeUrl(config.tilejson);
                if (!safe) throw new Err(400, null, `Blocked URL: ${reason}`);
            }

            const tj = await globalThis.fetch(url);
            if (!tj.ok) {
                throw new Err(400, null, 'Unable to fetch TileJSON from hosted basemap');
            }
            const tjJson = await tj.json() as Static<typeof TileJSON>;

            return {
                ...tjJson,
                type: config.type,
                tiles: [tileURL],
            };
        }

        return BasemapProtocol.json({
            ...config,
            url: tileURL,
        });
    }

    async tile(
        z: number, x: number, y: number,
        res: Response,
        opts?: TileOpts,
    ): Promise<void> {
        return this.protocol().tile(z, x, y, res, opts);
    }

    /**
     * Sample elevations along a line from a raster-dem basemap. Tiles are read
     * back through this server's own tile route so the proxy rules apply.
     */
    async elevation(
        geometry: LineString,
        opts: {
            token: string;
            upstreamToken: string;
            zoom?: number;
            samples?: number;
        },
    ): Promise<ElevationProfile> {
        const tilejson = await this.tilejson({
            token: opts.token,
            upstreamToken: opts.upstreamToken,
        });

        if (this.config.type !== 'raster-dem' || tilejson.type !== 'raster-dem' || tilejson.format === 'mvt') {
            throw new Err(400, null, 'Elevation profiles require raster-dem tiles');
        }

        const tileurl = tilejson.tiles[0];
        if (!tileurl) {
            throw new Err(400, null, 'Basemap has no tile URL');
        }

        const minzoom = tilejson.minzoom ?? this.config.minzoom ?? 0;
        const maxzoom = tilejson.maxzoom ?? this.config.maxzoom ?? 0;

        if (opts.zoom !== undefined && opts.zoom > maxzoom) {
            throw new Err(400, null, 'Above Layer MaxZoom');
        }

        if (opts.zoom !== undefined && opts.zoom < minzoom) {
            throw new Err(400, null, 'Below Layer MinZoom');
        }

        const encoding = this.config.encoding;
        if (!encoding) {
            throw new Err(400, null, 'Encoding could not be determined from the basemap metadata');
        }

        return await getElevationProfile(tileurl, geometry, {
            zoom: opts.zoom ?? maxzoom,
            encoding,
            targetSamples: opts.samples ?? 100,
        }, url => fetch(url, { safeUrlAllow: [Basemap.pmtilesUrl()] }));
    }
}
