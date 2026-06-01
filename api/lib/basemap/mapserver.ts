import Err from '@openaddresses/batch-error';
import type { Response } from 'express';
import typedFetch from '../fetch.js';
import type { Static } from '@sinclair/typebox';
import { Basemap_Type } from '../enums.js';
import { BasemapProtocol, TileJSONActions, TileOpts } from '../interface-basemap.js';
import FeatureServerBasemap from './featureserver.js';
import ImageServerBasemap from './imageserver.js';

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
        if (this.basemap?.type === Basemap_Type.RASTER) {
            return { feature: [] };
        }

        return super.actions();
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        if (this.basemap?.type === Basemap_Type.RASTER) {
            try {
                const url = ImageServerBasemap.esriRasterTileURL(this.basemap.url, z, x, y);

                const tileRes = await typedFetch(url);

                if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

                const tile = Buffer.from(await tileRes.arrayBuffer());

                res.writeHead(200, {
                    ...opts.headers,
                    'Content-Type': 'image/jpeg',
                    'Content-Length': Buffer.byteLength(tile),
                });

                res.write(tile);
                res.end();
            } catch (err) {
                if (err instanceof Err) throw err;
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI MapServer tile');
            }
        } else {
            return super._tile(z, x, y, res, opts);
        }
    }
}
