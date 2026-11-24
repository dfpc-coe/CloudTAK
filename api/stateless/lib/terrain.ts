import Config from '../../common/config.js';
import { Basemap_Type } from '../../common/enums.js';

/** Highest zoom level used for a lookup, one tile pixel is a few metres across at this level */
const MAX_LOOKUP_ZOOM = 15;

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Offset of the second point of the line sent to the tile server, in degrees (about 0.1 m).
 * The tile server samples elevations along a line and finds nothing to read for a line with a
 * single point, the sample at distance 0 is the first point itself
 */
const LINE_OFFSET = 0.000001;

/**
 * Look up the real-world elevation (in meters) at a given lng/lat from the default terrain
 * (raster-dem) basemap, using the elevation endpoint of the PMTiles tile server.
 *
 * This deliberately avoids MapLibre GL JS's queryTerrainElevation(), which
 * only returns a value once 3D terrain rendering has been enabled via
 * map.setTerrain() - a GPU-heavy mode that isn't otherwise needed for a
 * one-off elevation lookup, and can be unreliable/crash-prone on constrained
 * hardware.
 *
 * The request carries the token of the user that asked, so the tile server applies the same
 * access rules as for that user's own tile requests.
 *
 * Returns null if no terrain basemap is configured, the point falls outside
 * its tiles, or the tile server can't produce a value.
 */
export async function getElevation(
    config: Config,
    token: string,
    longitude: number,
    latitude: number,
): Promise<number | null> {
    try {
        const terrainSetting = await config.models.Setting.typed('map::terrain', null);
        const terrainId = terrainSetting.value;
        if (!terrainId) return null;

        const basemap = await config.models.Basemap.from(Number(terrainId));
        if (basemap.type !== Basemap_Type.TERRAIN) return null;

        const res = await fetch(`${config.BASEMAP_TILES_URL}/${basemap.id}/elevation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [longitude, latitude],
                        [longitude + (longitude < 180 - 2 * LINE_OFFSET ? LINE_OFFSET : -LINE_OFFSET), latitude],
                    ],
                },
                samples: 2,
                zoom: Math.min(basemap.maxzoom ?? MAX_LOOKUP_ZOOM, MAX_LOOKUP_ZOOM),
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!res.ok) {
            console.warn(`Elevation lookup failed: tile server returned ${res.status}`);
            return null;
        }

        const body = await res.json() as { samples?: Array<{ elevation?: number | null }> };
        const elevation = body.samples?.[0]?.elevation;

        return typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : null;
    } catch (err) {
        console.warn('Elevation lookup failed:', err instanceof Error ? err.message : String(err));
        return null;
    }
}
