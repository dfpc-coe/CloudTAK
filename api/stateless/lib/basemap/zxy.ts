import undici from 'undici';
import { Readable } from 'node:stream';
import { isSafeUrl } from '@tak-ps/node-safeurl';
import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { BasemapProtocol, TileOpts } from '../interface-basemap.js';

/**
 * @class
 *
 * ZXY / Quadkey basemap protocol.
 * Proxies standard slippy-map tile requests ({z}/{x}/{y} or {q} quadkey URLs)
 * by streaming the upstream response directly to the client.
 */
export default class ZXYBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        // Consistent Mapbox Style XYZ Endpoints: {z} vs TAK: {$z}
        const pathname = decodeURIComponent(str).replace(/\{\$/g, '{');

        if (
            !(pathname.includes('{z}') && pathname.includes('{x}') && pathname.includes('{y}'))
            && !pathname.includes('{q}')
        ) {
            throw new Err(400, null, 'ZXY protocol requires {z}/{x}/{y} tile variables or a {q} quadkey variable');
        }
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>,
    ): Promise<void> {
        const url = new URL(this.basemap!.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y))
            .replace(/\{\$?q\}/, String(BasemapProtocol.quadkey(z, x, y))),
        );

        let handledByErrorMapping = false;

        try {
            const { safe, reason } = await isSafeUrl(url.href);
            if (!safe) throw new Err(400, null, `Blocked tile URL: ${reason}`);

            const stream = undici.pipeline(url, {
                method: 'GET',
                headers: opts.headers as Record<string, string>,
            }, ({ statusCode, headers, body }) => {
                if (statusCode >= 400 && statusCode !== 404) {
                    // Drain the upstream body without forwarding it so the socket is released
                    body.resume();
                    body.on('error', () => {});

                    console.error(`Error: BasemapTileUpstream: ${url.hostname} returned ${statusCode}`);

                    const message = `Upstream tile server (${url.hostname}) returned ${statusCode}`;
                    handledByErrorMapping = true;
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 502, message, messages: [] }));

                    return Readable.from([]);
                }

                if (headers) {
                    for (const key in headers) {
                        if (
                            ![
                                'content-type',
                                'content-length',
                                'cache-control',
                                'content-encoding',
                                'last-modified',
                            ].includes(key.toLowerCase())
                        ) {
                            delete headers[key];
                        }
                    }
                }

                res.writeHead(statusCode, headers);
                return body;
            });

            await new Promise((resolve, reject) => {
                stream
                    .on('data', (buf) => {
                        if (!handledByErrorMapping) res.write(buf);
                    })
                    .on('error', (err) => {
                        if (handledByErrorMapping) return resolve(undefined);
                        return reject(err);
                    })
                    .on('end', () => {
                        if (!handledByErrorMapping) res.end();
                        return resolve(undefined);
                    })
                    .on('close', () => {
                        if (!handledByErrorMapping) res.end();
                        return resolve(undefined);
                    })
                    .end();
            });
        } catch (err) {
            if (handledByErrorMapping) return;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch tile');
        }
    }
}
