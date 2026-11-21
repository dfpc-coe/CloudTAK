/*
* Lifecycle of PMTiles archives stored for offline use. The profile_file row
* is the only record of what is stored and where; the OPFS (Atlas worker) and
* native (Capacitor downloader) backends only move bytes.
*/

import { reactive } from 'vue';
import * as Comlink from 'comlink';
import { FetchSource, type Source, type RangeResponse } from 'pmtiles';
import ProfileFileManager from '../../base/profile-file.ts';
import type { ProfileFile } from '../../types.ts';
import type AtlasTiles from '../../workers/atlas-tiles.ts';
import { offlineTilesHandle, removeOfflineTilesFile, pmtilesSize } from '../../utils/offline-tiles.ts';
import {
    supportsNativeTiles,
    startNativeTiles,
    removeNativeTiles,
    checkNativeTiles,
    listenNativeTiles,
    nativeTilesUrl,
} from '../../utils/native-tiles.ts';

type Waiter = {
    promise: Promise<void>;
    resolve: () => void;
    reject: (err: Error) => void;
};

export type OfflineTilesChange = (ids: Set<string>, changed: string[]) => void;

/**
 * Progress (0-1) of every in-flight download, keyed by asset id
 */
export const offlineTileDownloads = reactive(new Map<string, number>());

const waiters = new Map<string, Waiter>();

let writer: Comlink.Remote<AtlasTiles> | undefined;
let reconciling: Promise<void> | undefined;

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

function waiter(assetId: string): Waiter {
    let entry = waiters.get(assetId);

    if (!entry) {
        let resolve!: () => void;
        let reject!: (err: Error) => void;
        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        promise.catch(() => undefined);

        entry = { promise, resolve, reject };
        waiters.set(assetId, entry);
    }

    return entry;
}

function settle(assetId: string, err?: Error): void {
    offlineTileDownloads.delete(assetId);

    const entry = waiters.get(assetId);
    waiters.delete(assetId);

    if (err) {
        entry?.reject(err);
    } else {
        entry?.resolve();
    }
}

function lockName(assetId: string): string {
    return `cloudtak-offline-tiles:${assetId}`;
}

// An OPFS download dies with its tab, so the lock marks a row as live
async function withDownloadLock(assetId: string, fn: () => Promise<void>): Promise<void> {
    if (!navigator.locks) return await fn();
    await navigator.locks.request(lockName(assetId), fn);
}

async function isDownloading(assetId: string): Promise<boolean> {
    if (offlineTileDownloads.has(assetId)) return true;
    if (!navigator.locks) return false;

    return await navigator.locks.request(lockName(assetId), { ifAvailable: true }, async (lock) => !lock);
}

async function removeFiles(assetId: string): Promise<void> {
    await removeNativeTiles(assetId);
    await removeOfflineTilesFile(assetId);
}

async function complete(assetId: string, size: number): Promise<void> {
    const row = await ProfileFileManager.from(assetId);

    if (!row?.offline) {
        await removeFiles(assetId);
        settle(assetId, new Error('Download cancelled'));
        return;
    }

    if (row.offline.state === 'pending') {
        await ProfileFileManager.update(assetId, {
            offline: { ...row.offline, state: 'complete', size }
        });
    }

    settle(assetId);
}

async function fail(assetId: string, message: string): Promise<void> {
    const row = await ProfileFileManager.from(assetId);
    if (row?.offline?.state === 'complete') return;

    await ProfileFileManager.delete(assetId);
    await removeFiles(assetId);
    settle(assetId, new Error(message));
}

/**
 * Start (or rejoin) a download. Resolves once the archive is available offline.
 */
export async function downloadOfflineTiles(asset: ProfileFile): Promise<void> {
    const id = asset.id;

    if (offlineTileDownloads.has(id)) return await waiter(id).promise;

    offlineTileDownloads.set(id, 0);
    const { promise } = waiter(id);

    const size = pmtilesSize(asset);
    const backend = supportsNativeTiles(size) ? 'native' : 'opfs';
    const offline = { backend, state: 'pending', size: 0, started: Date.now() } as const;

    try {
        await removeFiles(id);

        if (backend === 'native') {
            await ProfileFileManager.generate({ ...asset, offline });
            await startNativeTiles(asset);
        } else {
            const tiles = writer;
            if (!tiles) throw new Error('Offline storage is not ready');

            await withDownloadLock(id, async () => {
                await ProfileFileManager.generate({ ...asset, offline });

                const written = await tiles.download(id, size, Comlink.proxy((percent: number) => {
                    if (offlineTileDownloads.has(id)) offlineTileDownloads.set(id, percent);
                }));

                await complete(id, written);
            });
        }
    } catch (err) {
        await fail(id, err instanceof Error ? err.message : String(err));
    }

    return await promise;
}

export async function removeOfflineTiles(assetId: string): Promise<void> {
    await ProfileFileManager.delete(assetId);
    settle(assetId, new Error('Download cancelled'));
    await removeFiles(assetId);
}

/**
 * Byte source of a complete archive, or undefined when the asset is not
 * stored or its file no longer matches the size recorded at completion
 */
export async function offlineTilesSource(assetId: string): Promise<Source | undefined> {
    const offline = (await ProfileFileManager.from(assetId))?.offline;
    if (offline?.state !== 'complete') return undefined;

    if (offline.backend === 'native') {
        const url = await nativeTilesUrl(assetId, offline.size);
        return url ? new FetchSource(url) : undefined;
    }

    const handle = await offlineTilesHandle(assetId);
    if (!handle) return undefined;

    const file = await handle.getFile();
    return file.size === offline.size ? new OPFSSource(assetId, file) : undefined;
}

/**
 * Settle downloads that finished (or died) while this WebView was not watching
 */
export async function reconcileOfflineTiles(): Promise<void> {
    reconciling ??= (async () => {
        try {
            for (const row of await ProfileFileManager.list()) {
                if (!row.offline) continue;

                if (row.offline.state === 'complete') {
                    // The user can delete or replace native archives from outside the app
                    if (row.offline.backend === 'native' && !await nativeTilesUrl(row.id, row.offline.size)) {
                        await ProfileFileManager.delete(row.id);
                    }
                    continue;
                }

                if (row.offline.backend === 'opfs') {
                    if (!await isDownloading(row.id)) await fail(row.id, 'Download interrupted');
                    continue;
                }

                const check = await checkNativeTiles(row, row.offline.started);

                if (check.state === 'active') {
                    offlineTileDownloads.set(row.id, check.progress);
                } else if (check.state === 'done') {
                    await complete(row.id, check.size);
                } else {
                    await fail(row.id, check.message);
                }
            }
        } finally {
            reconciling = undefined;
        }
    })();

    await reconciling;
}

/**
 * `onChange` receives the ids of every complete archive whenever that set
 * changes, in this or any other tab. Returns a teardown function.
 */
export function initOfflineTiles(tiles: Comlink.Remote<AtlasTiles>, onChange: OfflineTilesChange): () => void {
    writer = tiles;

    let current = new Set<string>();

    const subscription = ProfileFileManager.liveList().subscribe({
        next: (rows) => {
            const next = new Set<string>();
            for (const row of rows) {
                if (row.offline?.state === 'complete') next.add(row.id);
            }

            const changed = [
                ...[...next].filter((id) => !current.has(id)),
                ...[...current].filter((id) => !next.has(id)),
            ];
            if (!changed.length) return;

            current = next;
            onChange(next, changed);
        },
        error: (err) => console.warn('Failed to list offline tiles', err)
    });

    const warn = (err: unknown) => console.warn('Failed to settle offline tiles', err);

    void listenNativeTiles({
        progress: (id, progress) => {
            if (offlineTileDownloads.has(id)) offlineTileDownloads.set(id, progress);
        },
        done: (id, size) => void complete(id, size).catch(warn),
        failed: (id, message) => void fail(id, message).catch(warn),
        resume: () => void reconcileOfflineTiles().catch(warn),
    }).then(reconcileOfflineTiles).catch(warn);

    return () => subscription.unsubscribe();
}
