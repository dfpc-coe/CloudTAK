/*
* cloudtak-pmtiles://<asset id>/{z}/{x}/{y} - the tile source for every
* profile asset overlay. Tiles are read from the PMTiles archive cached in
* OPFS when a complete download exists and fetched from the hosted tile
* server otherwise, so the MapLibre source never changes as files come and go.
*/

import * as mapgl from 'maplibre-gl';
import { PMTiles, TileType, type Source, type RangeResponse } from 'pmtiles';
import { std, stdurl } from '../../std.ts';
import {
    PMTILES_PROTOCOL,
    offlineTilesHandle,
    hasCompleteOfflineTiles,
    offlineTileJSON as buildTileJSON,
} from '../../utils/offline-tiles.ts';
import type { OverlayTileJSON } from '../../types.ts';

export { offlineTileTemplate, isOfflineTileJSON } from '../../utils/offline-tiles.ts';

class OPFSSource implements Source {
    constructor(
        private readonly key: string,
        private readonly file: File,
    ) {}

    getKey(): string {
        return this.key;
    }

    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        return { data: await this.file.slice(offset, offset + length).arrayBuffer() };
    }
}

// 1x1 transparent PNG returned for raster tiles that do not exist
const EMPTY_PNG = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
    (c) => c.charCodeAt(0)
);

// Presence is resolved once per asset (null = no complete download) and
// invalidated by the worker's download/remove events
const archives = new Map<string, Promise<PMTiles | null>>();
const templates = new Map<string, Promise<string>>();

let protocolRegistered = false;

function emptyTile(vector: boolean): ArrayBuffer {
    return vector ? new ArrayBuffer(0) : EMPTY_PNG.slice().buffer;
}

function offlineArchive(assetId: string): Promise<PMTiles | null> {
    let archive = archives.get(assetId);

    if (!archive) {
        archive = (async () => {
            if (!await hasCompleteOfflineTiles(assetId)) return null;

            const handle = await offlineTilesHandle(assetId);
            if (!handle) return null;

            return new PMTiles(new OPFSSource(assetId, await handle.getFile()));
        })();

        archive.catch(() => archives.delete(assetId));
        archives.set(assetId, archive);
    }

    return archive;
}

export function invalidateOfflinePMTiles(assetId: string): void {
    archives.delete(assetId);
}

export async function offlineTileJSON(assetId: string): Promise<OverlayTileJSON> {
    const archive = await offlineArchive(assetId);
    if (!archive) throw new Error(`Asset ${assetId} is not available offline`);

    return buildTileJSON(assetId, await archive.getHeader(), await archive.getMetadata());
}

export function setNetworkTileTemplate(assetId: string, template: string): void {
    templates.set(assetId, Promise.resolve(template));
}

function networkTileTemplate(assetId: string): Promise<string> {
    let template = templates.get(assetId);

    if (!template) {
        template = (async () => {
            const tilejson = await std(stdurl(`/api/profile/asset/${assetId}.pmtiles/tile`)) as OverlayTileJSON;
            if (!tilejson.tiles?.length) throw new Error(`No tile URL for asset ${assetId}`);
            return tilejson.tiles[0];
        })();

        template.catch(() => templates.delete(assetId));
        templates.set(assetId, template);
    }

    return template;
}

async function networkTile(assetId: string, z: string, x: string, y: string, signal: AbortSignal) {
    const template = await networkTileTemplate(assetId);
    const url = template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const vector = /\.(mvt|pbf)(\?|$)/.test(template);

    const res = await fetch(url, { signal });

    if (res.status === 204 || res.status === 404) return { data: emptyTile(vector) };
    if (!res.ok) throw new Error(`Tile request failed (${res.status}): ${url}`);

    return {
        data: await res.arrayBuffer(),
        cacheControl: res.headers.get('Cache-Control') ?? undefined,
        expires: res.headers.get('Expires') ?? undefined,
    };
}

export function registerPMTilesProtocol(): void {
    if (protocolRegistered) return;
    protocolRegistered = true;

    mapgl.addProtocol(PMTILES_PROTOCOL, async (params, abortController) => {
        const match = /^cloudtak-pmtiles:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
        if (!match) throw new Error(`Unsupported PMTiles URL: ${params.url}`);

        const [, assetId, z, x, y] = match;

        const archive = await offlineArchive(assetId);
        if (!archive) return await networkTile(assetId, z, x, y, abortController.signal);

        const tile = await archive.getZxy(Number(z), Number(x), Number(y), abortController.signal);
        if (tile) return { data: tile.data };

        const header = await archive.getHeader();
        return { data: emptyTile(header.tileType === TileType.Mvt) };
    });
}
