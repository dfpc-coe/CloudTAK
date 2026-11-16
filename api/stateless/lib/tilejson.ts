import { bbox } from '@turf/bbox';
import jwt from 'jsonwebtoken';
import { Static, Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { isSafeUrl, fetch as safeFetch } from '@tak-ps/node-safeurl';
import type ConfigStateless from '../config.js';
import { TileJSON } from '../../common/types.js';
import { BasemapProtocol, TileJSONActions } from './interface-basemap.js';
import { EsriBase, EsriProxyLayer } from './esri.js';
import BasemapControl from '../../common/control/basemap.js';
import type { TileArgs } from '../../common/control/basemap.js';

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

    let tileURL: string;
    if (hosted) {
        // Hosted PMTiles — pass the direct URL through; already on the same trusted host.
        tileURL = BasemapControl.applyTileArgs(basemap.url, basemap.args);
        if (opts.token) tileURL = tileURL + `${tileURL.includes('?') ? '&' : '?'}token=${opts.token}`;
    } else {
        // For external basemaps, check if the hostname is in the trusted-origins
        // allowlist (CLOUDTAK_TILE_ORIGINS). If so, return the direct URL so the
        // browser fetches tiles straight from the CDN instead of through the proxy.
        // The CSP in nginx.conf.js adds these same origins to connect-src/img-src.
        let isTrustedOrigin = false;
        try {
            const storedHostname = new URL(basemap.url).hostname;
            isTrustedOrigin = config.tileOriginHostnames.has(storedHostname);
        } catch {
            // malformed URL — fall through to proxy
        }

        if (isTrustedOrigin) {
            // Translate CloudTAK's {$z}/{$x}/{$y} storage notation to MapLibre's
            // standard {z}/{x}/{y} — the proxy handles both via regex, but the
            // browser receives the URL verbatim so it must use the standard form.
            tileURL = BasemapControl.applyTileArgs(basemap.url
                .replace(/\{\$?z\}/g, '{z}')
                .replace(/\{\$?x\}/g, '{x}')
                .replace(/\{\$?y\}/g, '{y}')
                .replace(/\{\$?q\}/g, '{q}'), basemap.args);
        } else {
            tileURL = BasemapControl.applyTileArgs(`${config.BASEMAP_TILES_URL}/${basemap.id}/tiles/{z}/{x}/{y}`, basemap.args);
            if (opts.token) tileURL = tileURL + `${tileURL.includes('?') ? '&' : '?'}token=${opts.token}`;
        }
    }

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
        const url = new URL(BasemapControl.applyTileArgs(basemap.tilejson, basemap.args));

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = await tj.json() as any;

        // Strip sprite/glyphs — external URLs from upstream TileJSON can't be
        // proxied and will 404, and leaving them in leaks a non-allowlisted origin
        // into the map style that the browser CSP then blocks.
        delete json.sprite;
        delete json.glyphs;

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
        for (const [key, value] of Object.entries((basemap.args ?? {}) as TileArgs)) {
            for (const v of Array.isArray(value) ? value : [value]) tilejsonUrl.searchParams.append(key, v);
        }
        tilejsonUrl.searchParams.set('token', opts.upstreamToken);

        const tj = await fetch(tilejsonUrl);
        if (!tj.ok) {
            throw new Err(400, null, 'Unable to fetch TileJSON from hosted basemap');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tjJson = await tj.json() as any;

        // Strip sprite/glyphs from the upstream PMTiles TileJSON — those
        // reference external URLs that cannot be proxied unless the basemap
        // record has an explicit tilejson blob overriding them. The blob
        // spread below will restore them for basemaps that do have a sprite.
        delete tjJson.sprite;
        delete tjJson.glyphs;

        // Merge tilejson blob (e.g. sprite) if stored as JSON on the basemap record
        let tilejsonBlobPmtiles: Record<string, unknown> = {};
        if (basemap.tilejson && !basemap.tilejson.startsWith('http://') && !basemap.tilejson.startsWith('https://')) {
            try {
                tilejsonBlobPmtiles = JSON.parse(basemap.tilejson);
            } catch {
                // Not valid JSON — ignore
            }
        }

        return {
            ...tjJson,
            ...tilejsonBlobPmtiles,
            type: basemap.type,
            tiles: [tileURL],
        };
    } else {
        const json = BasemapProtocol.json({
            ...basemap,
            bounds: basemap.bounds ? bbox(basemap.bounds) : undefined,
            center: basemap.center ?? undefined,
            url: tileURL,
        });

        // If tilejson is a JSON blob (not a URL), merge its fields into the
        // response — this allows sprite/glyphs and other MapLibre style
        // properties to be stored per-basemap without a schema change.
        let tilejsonBlob: Record<string, unknown> = {};
        if (basemap.tilejson && !basemap.tilejson.startsWith('http://') && !basemap.tilejson.startsWith('https://')) {
            try {
                tilejsonBlob = JSON.parse(basemap.tilejson);
            } catch {
                // Not valid JSON — ignore
            }
        }

        return {
            ...json,
            ...tilejsonBlob,
        } as Static<typeof TileJSON>;
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
