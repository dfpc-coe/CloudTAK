import { bbox } from '@turf/bbox';
import jwt from 'jsonwebtoken';
import { Static, Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { isSafeUrl, fetch as safeFetch } from '@tak-ps/node-safeurl';
import type ConfigStateless from '../config.js';
import { TileJSON } from '../../common/types.js';
import { BasemapProtocol, TileJSONActions } from './interface-basemap.js';
import { EsriBase, EsriProxyLayer } from './esri.js';

export const AugmentedTileJSON = Type.Composite([
    TileJSON,
    Type.Object({
        actions: TileJSONActions,
    }),
]);

export function isEsriLayerURL(url: string): boolean {
    return !!(
        String(url).match(/\/FeatureServer\/\d+$/)
        || String(url).match(/\/MapServer\/\d+$/)
        || String(url).match(/\/ImageServer$/)
    );
}

/**
 * Resolve a Basemap's TileJSON. `token` is interpolated into tile URLs; omit
 * it for a token-free document the client can persist. `upstreamToken`
 * authenticates metadata fetches against the hosted PMTiles server.
 */
export async function basemapTileJSON(
    config: ConfigStateless,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    basemap: any,
    opts: {
        token?: string;
        upstreamToken: string;
    },
): Promise<Static<typeof TileJSON>> {
    const pmtilesHost = new URL(config.PMTILES_URL || 'http://localhost:5001').hostname;
    const hosted = basemap.url.includes(pmtilesHost);

    let tileURL = hosted ? basemap.url : config.API_URL + `/api/basemap/${basemap.id}/tiles/{z}/{x}/{y}`;
    if (opts.token) tileURL = tileURL + `?token=${opts.token}`;

    const esriMetadataURL = basemap.tilejson || basemap.url;

    if (isEsriLayerURL(esriMetadataURL)) {
        const base = new EsriBase(new URL(esriMetadataURL));
        const layer = new EsriProxyLayer(base);
        const metadata = await layer.tilejson();

        return BasemapProtocol.json({
            ...basemap,
            ...metadata,
            type: basemap.type,
            minzoom: basemap.minzoom ?? metadata.minzoom,
            maxzoom: basemap.maxzoom ?? metadata.maxzoom,
            bounds: basemap.bounds ? bbox(basemap.bounds) : metadata.bounds,
            center: basemap.center ?? metadata.center,
            url: tileURL,
        });
    }

    if (basemap.tilejson && (basemap.tilejson.startsWith('http://') || basemap.tilejson.startsWith('https://'))) {
        const url = new URL(basemap.tilejson);

        if (url.hostname === pmtilesHost) {
            url.searchParams.set('token', opts.upstreamToken);
        } else {
            // Skip isSafeUrl check when StackName=test (test mode)
            if (process.env.StackName !== 'test') {
                const { safe, reason } = await isSafeUrl(basemap.tilejson);
                if (!safe) throw new Err(400, null, `Blocked URL: ${reason}`);
            }
        }

        const tj = await fetch(url);

        if (!tj.ok) {
            throw new Err(400, null, 'Unable to fetch TileJSON from source URL');
        }

        const json = await tj.json();

        return {
            ...json,
            type: basemap.type,
        };
    } else if (hosted) {
        // Hosted PMTiles basemap without a stored tilejson URL.
        // Reconstruct the TileJSON endpoint using the known PMTiles host and the
        // path up to (but not including) the tile-coordinate template segment.
        const parsedUrl = new URL(basemap.url);
        const tilejsonUrl = new URL(config.PMTILES_URL);
        // URL.pathname percent-encodes the `{z}/{x}/{y}` template braces to
        // `%7B`/`%7D`, so decode before stripping the tile-coordinate segment.
        tilejsonUrl.pathname = decodeURIComponent(parsedUrl.pathname).replace(/\/tiles\/\{[^}]+\}.*$/, '');
        tilejsonUrl.searchParams.set('token', opts.upstreamToken);

        const tj = await fetch(tilejsonUrl);
        if (!tj.ok) {
            throw new Err(400, null, 'Unable to fetch TileJSON from hosted basemap');
        }
        const tjJson = await tj.json();

        return {
            ...tjJson,
            type: basemap.type,
            tiles: [tileURL],
        };
    } else {
        return BasemapProtocol.json({
            ...basemap,
            bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
            center: basemap.center ?? undefined,
            url: tileURL,
        });
    }
}

/** TileJSON for a hosted PMTiles asset; tile URLs carry a file-scoped signed token */
export async function profileAssetTileJSON(
    config: ConfigStateless,
    opts: {
        email: string;
        owner: string;
        asset: string;
    },
): Promise<Static<typeof TileJSON>> {
    const token = jwt.sign({
        access: 'profile',
        email: opts.email,
        file: `${opts.owner}/${opts.asset}`,
    }, config.SigningSecret);

    const url = new URL(`${config.PMTILES_URL}/tiles/profile/${opts.owner}/${opts.asset}`);
    url.searchParams.append('token', token);

    const tilejson = await safeFetch(url);
    if (!tilejson.ok) {
        throw new Err(tilejson.status, null, `Failed to retrieve TileJSON: ${await tilejson.text()}`);
    }

    return await tilejson.json() as Static<typeof TileJSON>;
}
