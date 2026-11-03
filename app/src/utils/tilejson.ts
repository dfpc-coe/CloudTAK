import { server, std } from '../std.ts';

const BASEMAP_TILEJSON_URL = /^(?:https?:\/\/[^/]+)?\/api\/basemap\/(\d+)\/tiles\/?$/;

/** Basemap ID of a `/api/basemap/:id/tiles` overlay URL */
export function basemapIdFromUrl(url: string): number | undefined {
    const match = BASEMAP_TILEJSON_URL.exec(url);
    return match ? Number(match[1]) : undefined;
}

/** Basemap TileJSON from the PMTiles tile server */
export async function fetchBasemapTileJSON<T>(id: number): Promise<T> {
    const { data, error } = await server.GET('/api/config/tiles');
    if (error) throw new Error(error.message || 'Failed to load tile configuration');
    if (!data?.url) throw new Error('Tile configuration did not include a PMTiles URL');

    return await std(`${data.url.replace(/\/$/, '')}/tiles/basemap/${id}/tiles`) as T;
}

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
