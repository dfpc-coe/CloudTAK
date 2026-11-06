import type Config from '../config.js';

/** Query params a basemap or profile overlay appends to every tile request */
export type TileArgs = Record<string, string | string[]>;

export default class BasemapControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Append stored args as query params. String-edited rather than via URL
     * so `{z}/{x}/{y}` templates are not percent-encoded.
     */
    static applyTileArgs(url: string, args?: TileArgs | null): string {
        if (!args) return url;

        const params: string[] = [];
        for (const [key, value] of Object.entries(args)) {
            for (const v of Array.isArray(value) ? value : [value]) {
                params.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
            }
        }

        if (!params.length) return url;

        return `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}`;
    }
}
