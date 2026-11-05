import type { Response } from 'express';
import { BasemapProtocol, ResolvedTileOpts, TileBuffer } from './protocol.js';

/**
 * ZXY / Quadkey basemap protocol.
 * Proxies standard slippy-map tile requests ({z}/{x}/{y} or {q} quadkey URLs)
 * by streaming the upstream response directly to the client.
 */
export default class ZXYBasemap extends BasemapProtocol {
    url(z: number, x: number, y: number): URL {
        return new URL(this.basemap.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y))
            .replace(/\{\$?q\}/, String(BasemapProtocol.quadkey(z, x, y))),
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
        return this.fetchBuffer(this.url(z, x, y), opts);
    }
}
