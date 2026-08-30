/**
 * Append the session token to tile URLs served by CloudTAK itself (the API
 * and the hosted PMTiles server). Third-party tile hosts from external
 * TileJSON imports must never receive it, and URLs that already carry a
 * token (hosted profile assets use a file-scoped signed token) are left
 * untouched.
 *
 * URLs are edited as strings rather than via `URL`: the WHATWG serializer
 * percent-encodes the `{z}/{x}/{y}` template braces MapLibre substitutes.
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
