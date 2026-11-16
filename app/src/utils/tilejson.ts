/**
 * Append the session token to tile URLs on CloudTAK hosts only - never third
 * party tile servers. String-edited: `URL` percent-encodes `{z}/{x}/{y}`.
 */
export function authorizeTileJSON<T extends { tiles: string[] }>(
    tilejson: T,
    token: string | undefined,
    hosts: Iterable<string>
): T {
    if (!token) return tilejson;

    const allowed = new Set(hosts);

    const tiles = tilejson.tiles.map((tile) => {
        let url: URL;
        try {
            url = new URL(tile);
        } catch {
            return tile;
        }

        if (!allowed.has(url.hostname) || url.searchParams.has('token')) return tile;

        return `${tile}${tile.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    });

    return { ...tilejson, tiles };
}

export type TileArgs = Record<string, string | string[]>;

/**
 * Apply an overlay's args as query params on every tile URL, replacing any
 * existing values for the same keys so a user override beats the basemap's.
 * The template path is left untouched; only the query is rebuilt.
 */
export function applyTileArgs<T extends { tiles: string[] }>(tilejson: T, args?: TileArgs | null): T {
    if (!args || !Object.keys(args).length) return tilejson;

    const tiles = tilejson.tiles.map((tile) => {
        const [base, query = ''] = tile.split('?', 2);
        const params = new URLSearchParams(query);

        for (const [key, value] of Object.entries(args)) {
            params.delete(key);
            for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
        }

        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
    });

    return { ...tilejson, tiles };
}
