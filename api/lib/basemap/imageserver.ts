import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import typedFetch from '../fetch.js';
import { BasemapProtocol, TileJSONInterface, TileOpts } from '../interface-basemap.js';

/**
 * @class
 *
 * ESRI ImageServer basemap protocol.
 * Fetches raster tiles from an ArcGIS ImageServer by building an exportImage
 * request and returning the resulting JPEG image to the client.
 */
export default class ImageServerBasemap extends BasemapProtocol {

    /**
     * Build an ESRI ImageServer exportImage URL for the given tile coordinates.
     *
     * @param layer - ImageServer base URL
     * @param z     - Zoom level
     * @param x     - Tile column
     * @param y     - Tile row
     */
    static esriRasterTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        if (!url.pathname.endsWith('/exportImage')) {
            url.pathname = url.pathname + '/exportImage';
        }

        url.searchParams.set('f', 'image');

        const bbox = BasemapProtocol.extent(z, x, y);

        url.searchParams.append('imageSR', '3857');
        url.searchParams.append('size', '512,512');
        url.searchParams.append('interpolation', 'RSP_CubicConvolution');
        url.searchParams.append('bboxSR', '4326');
        url.searchParams.append('bbox', `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);

        return url;
    }

    protected async _tile(
        config: TileJSONInterface,
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>
    ): Promise<void> {
        try {
            const url = ImageServerBasemap.esriRasterTileURL(config.url, z, x, y);

            const tileRes = await typedFetch(url);

            if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

            const tile = Buffer.from(await tileRes.arrayBuffer());

            res.writeHead(200, {
                ...opts.headers,
                'Content-Type': 'image/jpeg',
                'Content-Length': Buffer.byteLength(tile)
            });

            res.write(tile);
            res.end();
        } catch (err) {
            if (err instanceof Err) {
                throw err;
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI tile');
            }
        }
    }
}
