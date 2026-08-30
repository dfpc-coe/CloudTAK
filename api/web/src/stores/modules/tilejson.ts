/*
* cloudtak-tilejson:// - MapLibre protocol serving overlay TileJSON documents
* from the local overlay database.
*
* Every tiled overlay source (raster, vector, raster-dem) points its `url` at
* `cloudtak-tilejson://<overlay id>`. The document comes from the overlay
* record (synced from the API, persisted in Dexie) so a reload - online or
* offline - never fetches TileJSON. Only an overlay with no document yet
* falls back to the API. Tile URLs are stored token-free and stamped with
* the current session token on every request.
*/

import * as mapgl from 'maplibre-gl';
import { db } from '../../database.ts';
import KV from '../../base/kv.ts';
import { std, server, serverUrl, getRuntimeToken } from '../../std.ts';
import { authorizeTileJSON } from '../../utils/tilejson.ts';
import type { OverlayTileJSON } from '../../types.ts';

export type { OverlayTileJSON };

const TILEJSON_PROTOCOL = 'cloudtak-tilejson';
const TILES_URL_KEY = 'tiles::url';

type TileJSONEntry = {
    url: string;
    tilejson: OverlayTileJSON | null;
};

// Loaded overlays register here before their source is added so the handler
// serves the instance's document rather than a possibly stale Dexie record
// (e.g. mid-replace(), before the PATCH response lands in the database).
const entries = new Map<number, TileJSONEntry>();

let protocolRegistered = false;
let tokenHosts: Promise<Set<string>> | undefined;

export function tileJSONSourceUrl(id: number): string {
    return `${TILEJSON_PROTOCOL}://${id}`;
}

export function setOverlayTileJSON(id: number, entry: TileJSONEntry): void {
    entries.set(id, { url: entry.url, tilejson: entry.tilejson });
}

export function clearOverlayTileJSON(id: number): void {
    entries.delete(id);
}

/**
 * Hosts whose tile URLs receive the session token: the API itself and the
 * hosted PMTiles server. The PMTiles URL is cached in KV so resolution works
 * offline after the first online map load.
 */
async function resolveTokenHosts(): Promise<{ hosts: Set<string>; complete: boolean }> {
    const hosts = new Set<string>([new URL(serverUrl).hostname]);

    let tilesUrl = await KV.value(TILES_URL_KEY);
    let complete = true;

    if (!tilesUrl) {
        try {
            const res = await server.GET('/api/config/tiles');
            if (res.data?.url) {
                tilesUrl = res.data.url;
                await KV.generate(TILES_URL_KEY, tilesUrl);
            } else {
                complete = false;
            }
        } catch (err) {
            complete = false;
            console.warn('Failed to resolve hosted tile server URL', err);
        }
    }

    if (tilesUrl) {
        try {
            hosts.add(new URL(tilesUrl).hostname);
        } catch {
            // Malformed - fall back to the API host alone
        }
    }

    return { hosts, complete };
}

function getTokenHosts(): Promise<Set<string>> {
    if (!tokenHosts) {
        tokenHosts = resolveTokenHosts().then(({ hosts, complete }) => {
            // Retry the PMTiles lookup on the next request instead of pinning
            // an incomplete host list for the session
            if (!complete) tokenHosts = undefined;
            return hosts;
        });
    }

    return tokenHosts;
}

export function registerTileJSONProtocol(): void {
    if (protocolRegistered) return;
    protocolRegistered = true;

    mapgl.addProtocol(TILEJSON_PROTOCOL, async (params) => {
        const match = /^cloudtak-tilejson:\/\/(-?\d+)\/?$/.exec(params.url);
        if (!match) throw new Error(`Unsupported TileJSON URL: ${params.url}`);

        const id = Number(match[1]);

        let entry = entries.get(id);
        if (!entry) {
            const record = await db.overlay.get(id);
            if (!record) throw new Error(`Overlay ${id} is not in the local database`);

            entry = { url: record.url, tilejson: record.tilejson ?? null };
            entries.set(id, entry);
        }

        if (!entry.tilejson) {
            entry.tilejson = await std(entry.url) as OverlayTileJSON;

            // Best effort: persist so the next reload is served locally
            await db.overlay.update(id, { tilejson: entry.tilejson }).catch((err: unknown) => {
                console.warn(`Failed to cache TileJSON for overlay ${id}`, err);
            });
        }

        return {
            data: authorizeTileJSON(entry.tilejson, await getRuntimeToken(), await getTokenHosts())
        };
    });
}
