/*
* AtlasTiles - Stream PMTiles archives into OPFS, which only allows
* synchronous writes from a worker
*/

import type Atlas from './atlas.ts';
import { stdurl } from '../std.ts';
import { offlineTilesDirectory, offlineTilesFileName } from '../utils/offline-tiles.ts';

export type TilesProgress = (percent: number) => void;

export default class AtlasTiles {
    atlas: Atlas;

    constructor(atlas: Atlas) {
        this.atlas = atlas;
    }

    /**
     * Resolves with the number of bytes written
     */
    async download(assetId: string, expectedSize?: number, onProgress?: TilesProgress): Promise<number> {
        const res = await fetch(stdurl(`/api/profile/asset/${assetId}.pmtiles`), {
            headers: this.atlas.token ? { Authorization: `Bearer ${this.atlas.token}` } : {}
        });

        if (!res.ok || !res.body) {
            throw new Error(`Download failed (${res.status})`);
        }

        const total = Number(res.headers.get('Content-Length')) || expectedSize || 0;

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

        return received;
    }
}
