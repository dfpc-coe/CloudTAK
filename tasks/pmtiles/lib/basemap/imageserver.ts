import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { fetch as typedFetch } from '@tak-ps/node-safeurl';
import { BasemapProtocol, ResolvedTileOpts, TileBuffer, UPSTREAM_TIMEOUT_MS, assertTileSize } from './protocol.js';

/**
 * ESRI ImageServer basemap protocol.
 * Fetches raster tiles from an ArcGIS ImageServer by building an exportImage
 * request and returning the resulting JPEG image to the client.
 */
export default class ImageServerBasemap extends BasemapProtocol {
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

    protected async _buffer(
        z: number, x: number, y: number,
        opts: ResolvedTileOpts,
    ): Promise<TileBuffer | null> {
        void opts;

        try {
            const url = ImageServerBasemap.esriRasterTileURL(this.basemap.url, z, x, y);

            const tileRes = await typedFetch(url, { timeout: UPSTREAM_TIMEOUT_MS });

            if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

            const data = Buffer.from(await tileRes.arrayBuffer());

            assertTileSize(data.byteLength);

            return { data, contentType: 'image/jpeg' };
        } catch (err) {
            if (err instanceof Err) {
                throw err;
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI tile');
            }
        }
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: ResolvedTileOpts,
    ): Promise<void> {
        const tile = await this._buffer(z, x, y, opts);

        if (!tile) {
            res.status(204).send('');
            return;
        }

        res.writeHead(200, {
            ...opts.headers,
            'Content-Type': 'image/jpeg',
            'Content-Length': tile.data.byteLength,
            'Cache-Control': 'public, max-age=3600',
        });

        res.write(tile.data);
        res.end();
    }
}
