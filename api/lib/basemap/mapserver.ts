import Err from '@openaddresses/batch-error';
import type { Response } from 'express';
import { fetch as typedFetch } from '@tak-ps/node-safeurl';
import type { Static } from '@sinclair/typebox';
import { Basemap_Type } from '../enums.js';
import { BasemapProtocol, TileJSONActions, TileOpts } from '../interface-basemap.js';
import FeatureServerBasemap from './featureserver.js';

/**
 * @class
 *
 * ESRI MapServer basemap protocol.
 * MapServer layers can expose either vector feature data or raster imagery.
 * The service type is discovered at basemap creation time (POST /basemap) and
 * persisted as the basemap's `type` field.  Tile requests are then routed to
 * the appropriate delivery mechanism based on that stored value:
 *  - VECTOR: Uses the FeatureServer query endpoint to deliver vector tiles (PBF)
 *  - RASTER: Uses the MapServer exportImage endpoint to deliver raster images
 */
export default class MapServerBasemap extends FeatureServerBasemap {
    isValidURL(str: string): void {
        // Bypass the FeatureServer pattern check — call base HTTP/S validation directly
        BasemapProtocol.prototype.isValidURL.call(this, str);

        if (!str.match(/\/MapServer\/\d+$/)) {
            throw new Err(400, null, 'MapServer protocol requires a URL ending with /MapServer/{id}');
        }
    }

    /**
     * Return the feature actions supported by this layer.
     * Raster MapServer layers do not support feature querying or fetching.
     */
    actions(): Static<typeof TileJSONActions> {
        if (this.basemap?.type === Basemap_Type.VECTOR) {
            return super.actions();
        }

        return { feature: [] };
    }

    /**
     * Build an ESRI MapServer export URL for the given tile coordinates.
     * MapServer uses the /export endpoint (not /exportImage like ImageServer).
     *
     * @param layer - MapServer base URL
     * @param z     - Zoom level
     * @param x     - Tile column
     * @param y     - Tile row
     */
    static esriMapServerTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        // Extract sublayer ID if present (e.g., /MapServer/3 -> sublayerId=3)
        // and strip it from the path, since /export only works at the service level
        const sublayerMatch = url.pathname.match(/\/MapServer\/(\d+)\/?$/);
        let sublayerId: string | undefined;

        if (sublayerMatch) {
            sublayerId = sublayerMatch[1];
            // Remove the sublayer ID from the path: /MapServer/3 -> /MapServer
            url.pathname = url.pathname.replace(/\/\d+\/?$/, '');
        }

        if (!url.pathname.endsWith('/export')) {
            url.pathname = url.pathname + '/export';
        }

        const bbox = BasemapProtocol.extent(z, x, y);

        url.searchParams.append('f', 'image');
        url.searchParams.append('format', 'png');
        url.searchParams.append('imageSR', '3857');
        url.searchParams.append('size', '512,512');
        url.searchParams.append('bboxSR', '4326');
        url.searchParams.append('bbox', `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);
        url.searchParams.append('transparent', 'true');

        // If we extracted a sublayer ID, add it as a layers parameter
        if (sublayerId) {
            url.searchParams.append('layers', `show:${sublayerId}`);
        }

        return url;
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        if (this.basemap?.type === Basemap_Type.VECTOR) {
            return super._tile(z, x, y, res, opts);
        } else {
            try {
                const url = MapServerBasemap.esriMapServerTileURL(this.basemap!.url, z, x, y);

                const tileRes = await typedFetch(url);

                if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

                const tile = Buffer.from(await tileRes.arrayBuffer());

                res.writeHead(200, {
                    ...opts.headers,
                    'Content-Type': 'image/png',
                    'Content-Length': Buffer.byteLength(tile),
                });

                res.write(tile);
                res.end();
            } catch (err) {
                if (err instanceof Err) throw err;
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI MapServer tile');
            }
        }
    }
}
