export type TileArgs = Record<string, string | string[]>;

/**
 * Append stored basemap args as query params. String-edited rather than via
 * URL so `{z}/{x}/{y}` templates are not percent-encoded.
 */
export function applyTileArgs(url: string, args?: TileArgs | null): string {
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
