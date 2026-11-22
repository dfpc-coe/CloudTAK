/*
* Background PMTiles downloads on iOS and Android through the Capacitor
* downloader plugin. Main thread only - the Atlas worker cannot reach
* Capacitor plugins.
*/

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorDownloader } from '@capgo/capacitor-downloader';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { stdurl, getRuntimeToken } from '../std.ts';
import type { ProfileFile } from '../types.ts';
import { offlineTilesFileName, pmtilesSize } from './offline-tiles.ts';

// Capacitor's Android file server addresses byte ranges with a signed 32 bit int
const ANDROID_MAX_BYTES = 2 ** 31 - 1;

export const NATIVE_TILES_DIR = 'Overlays';

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export type NativeTilesCheck =
    | { state: 'active'; progress: number }
    | { state: 'done'; size: number }
    | { state: 'failed'; message: string };

export type NativeTilesHandlers = {
    progress: (assetId: string, progress: number) => void;
    done: (assetId: string, size: number) => void;
    failed: (assetId: string, message: string) => void;
    resume: () => void;
};

let listeners: Promise<unknown> | undefined;

function isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
}

export function supportsNativeTiles(size?: number): boolean {
    if (!Capacitor.isNativePlatform()) return false;
    if (isIOS()) return true;
    return (size ?? 0) <= ANDROID_MAX_BYTES;
}

// Documents on iOS and the app's external files on Android, both of which
// the user can browse from the device
function location(assetId: string): { directory: Directory; path: string } {
    return {
        directory: isIOS() ? Directory.Documents : Directory.External,
        path: `${NATIVE_TILES_DIR}/${offlineTilesFileName(assetId)}`
    };
}

async function stat(assetId: string): Promise<{ uri: string; size: number } | undefined> {
    const { directory, path } = location(assetId);

    try {
        const { uri, size } = await Filesystem.stat({ directory, path });
        return { uri, size };
    } catch {
        return undefined;
    }
}

/**
 * WebView URL of a completed native archive, or undefined when the file is
 * missing or no longer matches the size recorded at completion
 */
export async function nativeTilesUrl(assetId: string, size: number): Promise<string | undefined> {
    if (!Capacitor.isNativePlatform()) return undefined;

    const file = await stat(assetId);
    if (!file || !size || file.size !== size) return undefined;

    return Capacitor.convertFileSrc(file.uri);
}

/**
 * Stop any transfer and delete the archive
 */
export async function removeNativeTiles(assetId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const { directory, path } = location(assetId);

    await CapacitorDownloader.stop({ id: assetId }).catch(() => undefined);
    await Filesystem.deleteFile({ directory, path }).catch(() => undefined);
}

/**
 * Start a background download. The transfer survives the WebView and, on
 * iOS and Android DownloadManager, the app process; the outcome is reported
 * through the listenNativeTiles handlers or checkNativeTiles.
 */
export async function startNativeTiles(asset: ProfileFile): Promise<void> {
    const token = await getRuntimeToken();

    await CapacitorDownloader.download({
        id: asset.id,
        url: String(stdurl(`/api/profile/asset/${asset.id}.pmtiles`)),
        destination: location(asset.id).path,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        notification: 'progress',
        title: asset.name,
        description: 'Downloading for offline use',
        iosContinuedProcessingTitle: asset.name,
        iosContinuedProcessingSubtitle: 'Downloading for offline use',
        downloadCompletedNotificationText: `${asset.name} is available offline`
    });
}

type RawStatus = {
    state?: string;
    progress?: number;
    status?: number;
    bytesDownloaded?: number;
    bytesTotal?: number;
};

// iOS reports { state, progress }; Android reports DownloadManager's
// { status, bytesDownloaded, bytesTotal }
async function status(assetId: string): Promise<{ state: 'ACTIVE' | 'DONE' | 'ERROR'; progress: number } | undefined> {
    let raw: RawStatus;
    try {
        raw = await CapacitorDownloader.checkStatus({ id: assetId }) as RawStatus;
    } catch {
        return undefined;
    }

    if (typeof raw.status === 'number') {
        const progress = raw.bytesTotal && raw.bytesTotal > 0 ? (raw.bytesDownloaded ?? 0) / raw.bytesTotal : 0;
        if (raw.status === 8) return { state: 'DONE', progress: 1 };
        if (raw.status === 16) return { state: 'ERROR', progress };
        return { state: 'ACTIVE', progress };
    }

    if (raw.state === 'DONE') return { state: 'DONE', progress: 1 };
    if (raw.state === 'ERROR') return { state: 'ERROR', progress: raw.progress ?? 0 };
    return { state: 'ACTIVE', progress: raw.progress ?? 0 };
}

/**
 * Where a download started at `started` stands now, including one that
 * finished (or died) while the WebView was not running
 */
export async function checkNativeTiles(asset: ProfileFile, started: number): Promise<NativeTilesCheck> {
    const current = await status(asset.id);

    if (current?.state === 'ACTIVE') return { state: 'active', progress: current.progress };
    if (current?.state === 'ERROR') return { state: 'failed', message: 'Download failed' };

    // The downloader no longer tracks the transfer after a process restart,
    // so the file on disk is the only evidence left. iOS moves the file into
    // place only on success; Android DownloadManager writes it in place.
    const file = await stat(asset.id);
    const expected = pmtilesSize(asset);

    if (file?.size && (current?.state === 'DONE' || isIOS() || file.size === expected)) {
        return { state: 'done', size: file.size };
    }

    if (Date.now() - started > PENDING_TTL_MS) return { state: 'failed', message: 'Download expired' };

    return { state: 'active', progress: file && expected ? Math.min(file.size / expected, 1) : 0 };
}

export async function listenNativeTiles(handlers: NativeTilesHandlers): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    listeners ??= Promise.all([
        CapacitorDownloader.addListener('downloadProgress', ({ id, progress }) => {
            handlers.progress(id, progress);
        }),
        CapacitorDownloader.addListener('downloadCompleted', ({ id }) => {
            void stat(id).then((file) => {
                if (file?.size) {
                    handlers.done(id, file.size);
                } else {
                    handlers.failed(id, 'Downloaded file is missing');
                }
            });
        }),
        CapacitorDownloader.addListener('downloadFailed', ({ id, error }) => {
            handlers.failed(id, error || 'Download failed');
        }),
        App.addListener('resume', () => {
            handlers.resume();
        })
    ]);

    await listeners;
}
