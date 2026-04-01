import undici from 'undici';
import type { Response } from 'express';
import Err from '@openaddresses/batch-error';
import { BasemapProtocol, TileOpts } from '../interface-basemap.js';

/**
 * @class
 *
 * Hosted PMTiles basemap protocol.
 * Proxies tile requests to a hosted PMTiles tileset served by the
 * CloudTAK tile server. URLs must point to a known tiles endpoint.
 */
export default class HostedBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        if (
            !(str.includes('{z}') && str.includes('{x}') && str.includes('{y}'))
            && !(str.includes('{$z}') && str.includes('{$x}') && str.includes('{$y}'))
        ) {
            throw new Err(400, null, 'Hosted protocol requires {z}/{x}/{y} tile variables');
        }
    }

    protected async _tile(
        z: number, x: number, y: number,
        res: Response,
        opts: Required<TileOpts>
    ): Promise<void> {
        const url = new URL(this.basemap!.url
            .replace(/\{\$?z\}/, String(z))
            .replace(/\{\$?x\}/, String(x))
            .replace(/\{\$?y\}/, String(y))
        );

        try {
            const stream = await undici.pipeline(url, {
                method: 'GET',
                headers: opts.headers as Record<string, string>
            }, ({ statusCode, headers, body }) => {
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
                    .on('data', (buf) => { res.write(buf); })
                    .on('error', (err) => { return reject(err); })
                    .on('end', () => { res.end(); return resolve(undefined); })
                    .on('close', () => { res.end(); return resolve(undefined); })
                    .end();
            });
        } catch (err) {
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch tile');
        }
    }
}
