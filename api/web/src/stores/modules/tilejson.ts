/*
* cloudtak-tilejson://<overlay id> - serves overlay TileJSON from the local
* overlay record (network only when no document exists yet), stamping the
* session token onto tile URLs per request.
*/

import * as mapgl from 'maplibre-gl';
import { db } from '../../database.ts';
import KV from '../../base/kv.ts';
import { std, server, serverUrl, getRuntimeToken } from '../../std.ts';
import { authorizeTileJSON } from '../../utils/tilejson.ts';
import { profileAssetIdFromUrl, hasCompleteOfflineTiles } from '../../utils/offline-tiles.ts';
import { registerPMTilesProtocol, offlineTileJSON, offlineTileTemplate, isOfflineTileJSON, setNetworkTileTemplate } from './pmtiles.ts';
import type { OverlayTileJSON } from '../../types.ts';

export type { OverlayTileJSON };

const TILEJSON_PROTOCOL = 'cloudtak-tilejson';
const TILES_URL_KEY = 'tiles::url';

type TileJSONEntry = {
    url: string;
    tilejson: OverlayTileJSON | null;
};

// In-memory overrides so a loaded overlay's document wins over a stale Dexie record
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

// API host plus the hosted PMTiles host, cached in KV so it resolves offline
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
            // Malformed - API host only
        }
    }

    return { hosts, complete };
}

function getTokenHosts(): Promise<Set<string>> {
    if (!tokenHosts) {
        tokenHosts = resolveTokenHosts().then(({ hosts, complete }) => {
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

        const cache = async (tilejson: OverlayTileJSON) => {
            entry.tilejson = tilejson;
            await db.overlay.update(id, { tilejson }).catch((err: unknown) => {
                console.warn(`Failed to cache TileJSON for overlay ${id}`, err);
            });
        };

        // Profile assets always tile through the PMTiles protocol, which picks
        // the OPFS archive or the hosted server per request
        const assetId = profileAssetIdFromUrl(entry.url);
        if (assetId) {
            registerPMTilesProtocol();

            let tilejson = entry.tilejson;
            if (!tilejson) {
                tilejson = await hasCompleteOfflineTiles(assetId)
                    ? await offlineTileJSON(assetId)
                    : await std(entry.url) as OverlayTileJSON;
                await cache(tilejson);
            }

            if (!isOfflineTileJSON(tilejson)) setNetworkTileTemplate(assetId, tilejson.tiles[0]);

            return {
                data: { ...tilejson, tiles: [offlineTileTemplate(assetId)] }
            };
        }

        let tilejson = entry.tilejson;
        if (!tilejson) {
            tilejson = await std(entry.url) as OverlayTileJSON;
            await cache(tilejson);
        }

        return {
            data: authorizeTileJSON(tilejson, await getRuntimeToken(), await getTokenHosts())
        };
    });
}
