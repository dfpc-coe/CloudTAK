/*
* AtlasTiles - Download PMTiles assets into OPFS for offline use
*/

import type Atlas from './atlas.ts';
import { stdurl } from '../std.ts';
import KV from '../base/kv.ts';
import ProfileFileManager from '../base/profile-file.ts';
import type { DBProfileFile } from '../database.ts';
import { WorkerMessageType } from '../utils/events.ts';
import {
    offlineTilesDirectory,
    offlineTilesFileName,
    offlineTilesSizeKey,
    hasCompleteOfflineTiles,
} from '../utils/offline-tiles.ts';

export type TilesProgress = (percent: number) => void;

export default class AtlasTiles {
    atlas: Atlas;

    constructor(atlas: Atlas) {
        this.atlas = atlas;
    }

    async has(assetId: string): Promise<boolean> {
        return await hasCompleteOfflineTiles(assetId);
    }

    async list(): Promise<string[]> {
        const dir = await offlineTilesDirectory();
        const ids: string[] = [];

        for await (const name of dir.keys()) {
            if (!name.endsWith('.pmtiles')) continue;

            const id = name.slice(0, -'.pmtiles'.length);
            if (await hasCompleteOfflineTiles(id)) ids.push(id);
        }

        return ids;
    }

    async remove(assetId: string): Promise<void> {
        await KV.delete(offlineTilesSizeKey(assetId));
        await ProfileFileManager.delete(assetId);

        const dir = await offlineTilesDirectory();
        await dir.removeEntry(offlineTilesFileName(assetId)).catch(() => undefined);

        await this.atlas.postMessage({
            type: WorkerMessageType.Tiles_Removed,
            body: { asset: assetId }
        });
    }

    async download(asset: DBProfileFile, onProgress?: TilesProgress): Promise<void> {
        const assetId = asset.id;
        const expectedSize = asset.artifacts.find((artifact) => artifact.ext === '.pmtiles')?.size;
        const url = stdurl(`/api/profile/asset/${assetId}.pmtiles`);

        const res = await fetch(url, {
            headers: this.atlas.token ? { Authorization: `Bearer ${this.atlas.token}` } : {}
        });

        if (!res.ok || !res.body) {
            throw new Error(`Download failed (${res.status})`);
        }

        const total = Number(res.headers.get('Content-Length')) || expectedSize || 0;

        await KV.delete(offlineTilesSizeKey(assetId));

        const dir = await offlineTilesDirectory();
        const name = offlineTilesFileName(assetId);
        const handle = await dir.getFileHandle(name, { create: true });
        const access = await handle.createSyncAccessHandle();

        const reader = res.body.getReader();
        let received = 0;

        try {
            access.truncate(0);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                access.write(value, { at: received });
                received += value.byteLength;

                if (onProgress && total) onProgress(Math.min(received / total, 1));
            }

            access.flush();
        } catch (err) {
            access.close();
            await dir.removeEntry(name).catch(() => undefined);
            throw err;
        }

        access.close();

        await KV.generate(offlineTilesSizeKey(assetId), String(received));
        await ProfileFileManager.generate(asset);
        if (onProgress) onProgress(1);

        await this.atlas.postMessage({
            type: WorkerMessageType.Tiles_Downloaded,
            body: { asset: assetId }
        });
    }
}
