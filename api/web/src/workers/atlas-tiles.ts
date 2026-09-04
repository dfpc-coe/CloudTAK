/*
* AtlasTiles - Download PMTiles assets into OPFS for offline use
*/

import type Atlas from './atlas.ts';
import { stdurl } from '../std.ts';

export type TilesProgress = (percent: number) => void;

export default class AtlasTiles {
    atlas: Atlas;

    static DIR = 'pmtiles';

    constructor(atlas: Atlas) {
        this.atlas = atlas;
    }

    private static fileName(assetId: string): string {
        return `${assetId}.pmtiles`;
    }

    private async directory(): Promise<FileSystemDirectoryHandle> {
        if (!navigator.storage?.getDirectory) {
            throw new Error('Offline storage is not supported on this device');
        }

        const root = await navigator.storage.getDirectory();
        return await root.getDirectoryHandle(AtlasTiles.DIR, { create: true });
    }

    async has(assetId: string): Promise<boolean> {
        try {
            const dir = await this.directory();
            await dir.getFileHandle(AtlasTiles.fileName(assetId));
            return true;
        } catch {
            return false;
        }
    }

    async list(): Promise<string[]> {
        const dir = await this.directory();
        const ids: string[] = [];

        for await (const name of dir.keys()) {
            if (name.endsWith('.pmtiles')) ids.push(name.slice(0, -'.pmtiles'.length));
        }

        return ids;
    }

    async remove(assetId: string): Promise<void> {
        const dir = await this.directory();
        await dir.removeEntry(AtlasTiles.fileName(assetId));
    }

    async download(assetId: string, onProgress?: TilesProgress): Promise<void> {
        const url = stdurl(`/api/profile/asset/${assetId}.pmtiles`);

        const res = await fetch(url, {
            headers: this.atlas.token ? { Authorization: `Bearer ${this.atlas.token}` } : {}
        });

        if (!res.ok || !res.body) {
            throw new Error(`Download failed (${res.status})`);
        }

        const total = Number(res.headers.get('Content-Length')) || 0;

        const dir = await this.directory();
        const name = AtlasTiles.fileName(assetId);
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
        if (onProgress) onProgress(1);
    }
}
