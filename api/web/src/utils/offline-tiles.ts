/*
* Shared OPFS layout for PMTiles assets cached for offline use. Imported by
* both the Atlas worker (which writes) and the main thread (which reads).
*/

import KV from '../base/kv.ts';
import { tileTypeExt, type Header } from 'pmtiles';
import type { OverlayTileJSON } from '../types.ts';

export const OFFLINE_TILES_DIR = 'pmtiles';
export const PMTILES_PROTOCOL = 'cloudtak-pmtiles';

const PROFILE_TILE_URL = /\/api\/profile\/asset\/([0-9a-f-]{36})\.pmtiles\/tile\/?$/i;

export function offlineTilesFileName(assetId: string): string {
    return `${assetId}.pmtiles`;
}

export function offlineTilesSizeKey(assetId: string): string {
    return `pmtiles::size::${assetId}`;
}

export function profileAssetIdFromUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;

    let pathname: string;
    try {
        pathname = new URL(url).pathname;
    } catch {
        pathname = url;
    }

    return PROFILE_TILE_URL.exec(pathname)?.[1];
}

export async function offlineTilesDirectory(): Promise<FileSystemDirectoryHandle> {
    if (!navigator.storage?.getDirectory) {
        throw new Error('Offline storage is not supported on this device');
    }

    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(OFFLINE_TILES_DIR, { create: true });
}

export async function offlineTilesHandle(assetId: string): Promise<FileSystemFileHandle | undefined> {
    try {
        const dir = await offlineTilesDirectory();
        return await dir.getFileHandle(offlineTilesFileName(assetId));
    } catch {
        return undefined;
    }
}

/**
 * A file only counts once its byte size matches the size recorded when the
 * download completed - a crash mid-stream leaves a truncated archive behind.
 */
export async function hasCompleteOfflineTiles(assetId: string): Promise<boolean> {
    const expected = Number(await KV.value(offlineTilesSizeKey(assetId)));
    if (!expected) return false;

    const handle = await offlineTilesHandle(assetId);
    if (!handle) return false;

    try {
        return (await handle.getFile()).size === expected;
    } catch {
        return false;
    }
}

export function offlineTileTemplate(assetId: string): string {
    return `${PMTILES_PROTOCOL}://${assetId}/{z}/{x}/{y}`;
}

export function isOfflineTileJSON(tilejson: { tiles: string[] }): boolean {
    return tilejson.tiles.some((tile) => tile.startsWith(`${PMTILES_PROTOCOL}://`));
}

/**
 * Mirror of the hosted tile server's TileJSON, built from the archive header
 * and metadata so an overlay can be created without ever having been online.
 */
export function offlineTileJSON(assetId: string, header: Header, metadata: unknown): OverlayTileJSON {
    const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};

    const tilejson: OverlayTileJSON = {
        tilejson: '3.0.0',
        version: '1.0.0',
        scheme: 'xyz',
        name: typeof meta.name === 'string' ? meta.name : assetId,
        description: typeof meta.description === 'string' ? meta.description : '',
        format: tileTypeExt(header.tileType).replace(/^\./, ''),
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
        center: [header.centerLon, header.centerLat, header.centerZoom],
        tiles: [offlineTileTemplate(assetId)],
    };

    if (typeof meta.attribution === 'string') tilejson.attribution = meta.attribution;
    if (Array.isArray(meta.vector_layers)) tilejson.vector_layers = meta.vector_layers as OverlayTileJSON['vector_layers'];

    return tilejson;
}
