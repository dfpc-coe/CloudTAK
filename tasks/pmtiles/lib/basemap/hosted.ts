import type { Response } from 'express';
import { BasemapProtocol, TileOpts } from './protocol.js';

/**
 * Hosted PMTiles basemap protocol.
 * Proxies tile requests to a hosted PMTiles tileset served by the
 * CloudTAK tile server.
 */
export default class HostedBasemap extends BasemapProtocol {
    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        const url = new URL(this.basemap.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y)),
        );

        return this.pipe(url, res, opts);
    }
}
