import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { fetch as typedFetch } from '@tak-ps/node-safeurl';
import type { Static } from '@sinclair/typebox';
import { TileJSONActions } from '../tilejson.js';
import { BasemapProtocol, ResolvedTileOpts, TileBuffer, assertTileSize } from './protocol.js';
import FeatureServerBasemap from './featureserver.js';

/**
 * ESRI MapServer basemap protocol.
 * Vector layers are delivered through the FeatureServer query path as PBF,
 * raster layers through the MapServer export endpoint as PNG, keyed on the
 * basemap `type` discovered at creation time.
 */
export default class MapServerBasemap extends FeatureServerBasemap {
    actions(): Static<typeof TileJSONActions> {
        if (this.basemap.type === 'vector') {
            return super.actions();
        }

        return { feature: [] };
    }

    static esriMapServerTileURL(layer: string, z: number, x: number, y: number): URL {
        const url = new URL(layer);

        const sublayerMatch = url.pathname.match(/\/MapServer\/(\d+)\/?$/);
        let sublayerId: string | undefined;

        if (sublayerMatch) {
            sublayerId = sublayerMatch[1];
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

        if (sublayerId) {
            url.searchParams.append('layers', `show:${sublayerId}`);
        }

        return url;
    }

    protected async _buffer(
        z: number, x: number, y: number,
        opts: ResolvedTileOpts,
    ): Promise<TileBuffer | null> {
        void opts;

        if (this.basemap.type === 'vector') {
            throw new Err(400, null, 'Vector MapServer basemaps cannot be rendered as raster');
        }

        try {
            const url = MapServerBasemap.esriMapServerTileURL(this.basemap.url, z, x, y);

            const tileRes = await typedFetch(url);

            if (!tileRes.ok) throw new Err(400, null, `Upstream Error: ${await tileRes.text()}`);

            const data = Buffer.from(await tileRes.arrayBuffer());

            assertTileSize(data.byteLength);

            return { data, contentType: 'image/png' };
        } catch (err) {
            if (err instanceof Err) throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch ESRI MapServer tile');
        }
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: ResolvedTileOpts,
    ): Promise<void> {
        if (this.basemap.type === 'vector') {
            return super._tile(z, x, y, res, opts);
        }

        const tile = await this._buffer(z, x, y, opts);

        if (!tile) {
            res.status(204).send('');
            return;
        }

        res.writeHead(200, {
            ...opts.headers,
            'Content-Type': 'image/png',
            'Content-Length': tile.data.byteLength,
            'Cache-Control': 'public, max-age=3600',
        });

        res.write(tile.data);
        res.end();
    }
}
