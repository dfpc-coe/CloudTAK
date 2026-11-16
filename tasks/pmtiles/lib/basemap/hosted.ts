import type { Response } from 'express';
import { FileTiles } from '../tiles.js';
import { BasemapProtocol, ResolvedTileOpts, TileBuffer } from './protocol.js';

/**
 * Hosted PMTiles basemap protocol.
 * Proxies tile requests to a hosted PMTiles tileset served by the
 * CloudTAK tile server. Buffered reads for compositing go straight to the
 * archive in S3 rather than back through this server's own HTTP routes.
 */
export default class HostedBasemap extends BasemapProtocol {
    url(z: number, x: number, y: number): URL {
        return new URL(this.basemap.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y)),
        );
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: ResolvedTileOpts,
    ): Promise<void> {
        return this.pipe(this.url(z, x, y), res, opts);
    }

    protected async _buffer(
        z: number, x: number, y: number,
        opts: ResolvedTileOpts,
    ): Promise<TileBuffer | null> {
        const url = this.url(z, x, y);

        const file = FileTiles.fromURL(url);
        if (file) return file.buffer(z, x, y);

        return this.fetchBuffer(url, opts);
    }
}
