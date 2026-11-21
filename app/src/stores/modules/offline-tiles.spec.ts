import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProfileFile } from '../../types.ts';

const state = vi.hoisted(() => ({
    platform: 'ios',
    files: new Map<string, number>(),
    listeners: new Map<string, (event: Record<string, unknown>) => void>(),
}));

const downloader = vi.hoisted(() => ({
    download: vi.fn(async () => ({})),
    stop: vi.fn(async () => undefined),
    checkStatus: vi.fn(async () => { throw new Error('Task not found'); }),
    addListener: vi.fn(async (name: string, fn: (event: Record<string, unknown>) => void) => {
        state.listeners.set(name, fn);
        return { remove: async () => undefined };
    }),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => state.platform !== 'web',
        getPlatform: () => state.platform,
        convertFileSrc: (uri: string) => uri,
    }
}));

vi.mock('@capacitor/app', () => ({
    App: {
        addListener: vi.fn(async (name: string, fn: (event: Record<string, unknown>) => void) => {
            state.listeners.set(name, fn);
            return { remove: async () => undefined };
        })
    }
}));

vi.mock('@capgo/capacitor-downloader', () => ({ CapacitorDownloader: downloader }));

vi.mock('@capacitor/filesystem', () => ({
    Directory: { Documents: 'DOCUMENTS', External: 'EXTERNAL' },
    Filesystem: {
        stat: vi.fn(async ({ path }: { path: string }) => {
            const size = state.files.get(path);
            if (size === undefined) throw new Error('File does not exist');
            return { uri: `file:///data/${path}`, size };
        }),
        deleteFile: vi.fn(async ({ path }: { path: string }) => {
            state.files.delete(path);
        }),
    }
}));

vi.mock('../../std.ts', () => ({
    stdurl: (path: string) => new URL(path, 'https://api.example.com'),
    getRuntimeToken: async () => 'token',
}));

const ID = '1db1f443-23e2-44b1-b879-fab2db95ce66';
const IOS_PATH = `Overlays/${ID}.pmtiles`;

const asset = {
    id: ID,
    name: 'Topo',
    path: '/',
    artifacts: [{ ext: '.pmtiles', size: 100 }],
} as unknown as ProfileFile;

async function load() {
    vi.resetModules();

    const tiles = await import('./offline-tiles.ts');
    const { default: files } = await import('../../base/profile-file.ts');

    const writer = { download: vi.fn(async () => 50) };
    const onChange = vi.fn();

    return { tiles, files, writer, onChange, init: () => tiles.initOfflineTiles(writer as never, onChange) };
}

beforeEach(async () => {
    await Dexie.delete('CloudTAK');

    state.platform = 'ios';
    state.files.clear();
    state.listeners.clear();
    vi.clearAllMocks();
});

describe('downloadOfflineTiles', () => {
    it('records a native archive once the downloader reports completion', async () => {
        const { tiles, files, writer, onChange, init } = await load();
        const stop = init();
        await vi.waitFor(() => expect(state.listeners.has('downloadCompleted')).toBe(true));

        const done = tiles.downloadOfflineTiles(asset);
        await vi.waitFor(() => expect(downloader.download).toHaveBeenCalled());

        expect((await files.from(ID))?.offline).toMatchObject({ backend: 'native', state: 'pending' });

        state.listeners.get('downloadProgress')?.({ id: ID, progress: 0.5 });
        expect(tiles.offlineTileDownloads.get(ID)).toBe(0.5);

        state.files.set(IOS_PATH, 100);
        state.listeners.get('downloadCompleted')?.({ id: ID });
        await done;

        expect((await files.from(ID))?.offline).toMatchObject({ backend: 'native', state: 'complete', size: 100 });
        expect(tiles.offlineTileDownloads.has(ID)).toBe(false);
        expect(writer.download).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(new Set([ID]), [ID]));

        expect(await tiles.offlineTilesSource(ID)).toBeDefined();
        state.files.set(IOS_PATH, 60);
        expect(await tiles.offlineTilesSource(ID)).toBeUndefined();

        stop();
    });

    it('rejects and forgets the asset when a native download fails', async () => {
        const { tiles, files, init } = await load();
        const stop = init();
        await vi.waitFor(() => expect(state.listeners.has('downloadFailed')).toBe(true));

        const done = tiles.downloadOfflineTiles(asset);
        await vi.waitFor(() => expect(downloader.download).toHaveBeenCalled());

        state.listeners.get('downloadFailed')?.({ id: ID, error: 'HTTP 401' });

        await expect(done).rejects.toThrow('HTTP 401');
        expect(await files.from(ID)).toBeUndefined();
        expect(tiles.offlineTileDownloads.has(ID)).toBe(false);

        stop();
    });

    it('writes through the worker off native platforms and joins a download in flight', async () => {
        state.platform = 'web';

        const { tiles, files, writer, init } = await load();
        const stop = init();

        await Promise.all([tiles.downloadOfflineTiles(asset), tiles.downloadOfflineTiles(asset)]);

        expect(writer.download).toHaveBeenCalledTimes(1);
        expect(writer.download).toHaveBeenCalledWith(ID, 100, expect.any(Function));
        expect(downloader.download).not.toHaveBeenCalled();
        expect((await files.from(ID))?.offline).toMatchObject({ backend: 'opfs', state: 'complete', size: 50 });

        stop();
    });

    it('forgets the asset when the worker download fails', async () => {
        state.platform = 'web';

        const { tiles, files, writer, init } = await load();
        const stop = init();

        writer.download.mockRejectedValueOnce(new Error('Download failed (500)'));

        await expect(tiles.downloadOfflineTiles(asset)).rejects.toThrow('Download failed (500)');
        expect(await files.from(ID)).toBeUndefined();

        stop();
    });
});

describe('removeOfflineTiles', () => {
    it('drops the row and the archive', async () => {
        const { tiles, files, onChange, init } = await load();

        await files.generate({ ...asset, offline: { backend: 'native', state: 'complete', size: 100, started: 0 } });
        state.files.set(IOS_PATH, 100);

        const stop = init();
        await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(new Set([ID]), [ID]));

        await tiles.removeOfflineTiles(ID);

        expect(await files.from(ID)).toBeUndefined();
        expect(state.files.has(IOS_PATH)).toBe(false);
        await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith(new Set(), [ID]));

        stop();
    });
});

describe('reconcileOfflineTiles', () => {
    it('completes a native download that finished while the app was not running', async () => {
        const { tiles, files } = await load();

        await files.generate({ ...asset, offline: { backend: 'native', state: 'pending', size: 0, started: Date.now() } });
        state.files.set(IOS_PATH, 100);

        await tiles.reconcileOfflineTiles();

        expect((await files.from(ID))?.offline).toMatchObject({ state: 'complete', size: 100 });
    });

    it('forgets a native archive the user deleted from outside the app', async () => {
        const { tiles, files } = await load();

        await files.generate({ ...asset, offline: { backend: 'native', state: 'complete', size: 100, started: 0 } });
        state.files.set(IOS_PATH, 100);

        await tiles.reconcileOfflineTiles();
        expect(await files.from(ID)).toBeDefined();

        state.files.delete(IOS_PATH);
        await tiles.reconcileOfflineTiles();
        expect(await files.from(ID)).toBeUndefined();
    });

    it('drops a native download that expired', async () => {
        const { tiles, files } = await load();

        await files.generate({ ...asset, offline: { backend: 'native', state: 'pending', size: 0, started: 1 } });

        await tiles.reconcileOfflineTiles();

        expect(await files.from(ID)).toBeUndefined();
    });

    it('drops a worker download interrupted by a reload', async () => {
        state.platform = 'web';
        const { tiles, files } = await load();

        await files.generate({ ...asset, offline: { backend: 'opfs', state: 'pending', size: 0, started: Date.now() } });

        await tiles.reconcileOfflineTiles();

        expect(await files.from(ID)).toBeUndefined();
    });
});

describe('ProfileFileManager.refresh', () => {
    it('updates stored metadata without losing offline state or adding rows', async () => {
        const { files } = await load();

        await files.generate({ ...asset, offline: { backend: 'opfs', state: 'complete', size: 100, started: 0 } });
        await files.refresh([
            { ...asset, name: 'Renamed' },
            { ...asset, id: 'other' },
        ]);

        expect(await files.from(ID)).toMatchObject({ name: 'Renamed', offline: { state: 'complete', size: 100 } });
        expect(await files.count()).toBe(1);
    });
});

describe('database upgrade', () => {
    it('moves KV download markers onto the profile_file row', async () => {
        const legacy = new Dexie('CloudTAK');
        legacy.version(6).stores({ kv: 'key', profile_file: 'id, name, path' });
        await legacy.table('profile_file').bulkPut([asset, { ...asset, id: 'partial' }]);
        await legacy.table('kv').bulkPut([
            { key: `pmtiles::size::${ID}`, value: '100' },
            { key: 'unrelated', value: '1' },
        ]);
        legacy.close();

        const { files } = await load();
        const { db } = await import('../../database.ts');

        expect(await files.list()).toEqual([
            { ...asset, offline: { backend: 'opfs', state: 'complete', size: 100, started: 0 } }
        ]);
        expect(await db.kv.toCollection().primaryKeys()).toEqual(['unrelated']);
    });
});
