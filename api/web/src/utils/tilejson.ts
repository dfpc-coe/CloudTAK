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
