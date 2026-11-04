import type { Response } from 'express';
import { BasemapProtocol, TileOpts } from './protocol.js';

/**
 * ZXY / Quadkey basemap protocol.
 * Proxies standard slippy-map tile requests ({z}/{x}/{y} or {q} quadkey URLs)
 * by streaming the upstream response directly to the client.
 */
export default class ZXYBasemap extends BasemapProtocol {
    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        const url = new URL(this.basemap.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y))
            .replace(/\{\$?q\}/, String(BasemapProtocol.quadkey(z, x, y))),
        );

        return this.pipe(url, res, opts);
    }
}
