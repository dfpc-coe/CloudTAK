import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProfileFile } from '../types.ts';

const state = vi.hoisted(() => ({
    platform: 'ios',
    files: new Map<string, number>(),
    listeners: new Map<string, (event: Record<string, unknown>) => void>(),
    status: undefined as Record<string, unknown> | undefined,
}));

const downloader = vi.hoisted(() => ({
    download: vi.fn(async () => ({})),
    stop: vi.fn(async () => undefined),
    checkStatus: vi.fn(async () => {
        if (!state.status) throw new Error('Task not found');
        return state.status;
    }),
    addListener: vi.fn(async (name: string, fn: (event: Record<string, unknown>) => void) => {
        state.listeners.set(name, fn);
        return { remove: async () => undefined };
    }),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => state.platform !== 'web',
        getPlatform: () => state.platform,
        convertFileSrc: (uri: string) => uri.replace('file://', 'capacitor://localhost/_capacitor_file_'),
    }
}));

vi.mock('@capacitor/app', () => ({
    App: { addListener: vi.fn(async () => ({ remove: async () => undefined })) }
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

vi.mock('../std.ts', () => ({
    stdurl: (path: string) => new URL(path, 'https://api.example.com'),
    getRuntimeToken: async () => 'token',
}));

const ID = '1db1f443-23e2-44b1-b879-fab2db95ce66';
const IOS_PATH = `Overlays/${ID}.pmtiles`;
const ANDROID_PATH = `Overlays/${ID}.pmtiles`;

const asset = {
    id: ID,
    name: 'Topo',
    artifacts: [{ ext: '.pmtiles', size: 100 }],
} as unknown as ProfileFile;

async function load() {
    vi.resetModules();
    return await import('./native-tiles.ts');
}

beforeEach(() => {
    state.platform = 'ios';
    state.files.clear();
    state.listeners.clear();
    state.status = undefined;
    vi.clearAllMocks();
});

describe('supportsNativeTiles', () => {
    it('is off on web and caps Android at 2 GiB', async () => {
        const tiles = await load();

        state.platform = 'web';
        expect(tiles.supportsNativeTiles(10)).toBe(false);

        state.platform = 'android';
        expect(tiles.supportsNativeTiles(10)).toBe(true);
        expect(tiles.supportsNativeTiles(2 ** 31)).toBe(false);

        state.platform = 'ios';
        expect(tiles.supportsNativeTiles(2 ** 33)).toBe(true);
    });
});

describe('startNativeTiles', () => {
    it('hands the authenticated archive URL to the downloader', async () => {
        const tiles = await load();
        await tiles.startNativeTiles(asset);

        expect(downloader.download).toHaveBeenCalledWith(expect.objectContaining({
            id: ID,
            url: `https://api.example.com/api/profile/asset/${ID}.pmtiles`,
            destination: `Overlays/${ID}.pmtiles`,
            headers: { Authorization: 'Bearer token' },
        }));
    });
});

describe('listenNativeTiles', () => {
    it('reports the size on disk when a download completes', async () => {
        const tiles = await load();
        const handlers = { progress: vi.fn(), done: vi.fn(), failed: vi.fn(), resume: vi.fn() };
        await tiles.listenNativeTiles(handlers);

        state.listeners.get('downloadProgress')?.({ id: ID, progress: 0.5 });
        expect(handlers.progress).toHaveBeenCalledWith(ID, 0.5);

        state.listeners.get('downloadCompleted')?.({ id: ID });
        await vi.waitFor(() => expect(handlers.failed).toHaveBeenCalledWith(ID, 'Downloaded file is missing'));

        state.files.set(IOS_PATH, 100);
        state.listeners.get('downloadCompleted')?.({ id: ID });
        await vi.waitFor(() => expect(handlers.done).toHaveBeenCalledWith(ID, 100));

        state.listeners.get('downloadFailed')?.({ id: ID, error: 'HTTP 401' });
        expect(handlers.failed).toHaveBeenCalledWith(ID, 'HTTP 401');
    });
});

describe('checkNativeTiles', () => {
    it('treats a file on iOS as a download that finished while the app was not running', async () => {
        state.files.set(IOS_PATH, 100);

        const tiles = await load();
        expect(await tiles.checkNativeTiles(asset, Date.now())).toEqual({ state: 'done', size: 100 });
    });

    it('leaves a partial Android file active until it reaches the expected size', async () => {
        state.platform = 'android';
        state.files.set(ANDROID_PATH, 40);

        const tiles = await load();
        expect(await tiles.checkNativeTiles(asset, Date.now())).toEqual({ state: 'active', progress: 0.4 });

        state.files.set(ANDROID_PATH, 100);
        expect(await tiles.checkNativeTiles(asset, Date.now())).toEqual({ state: 'done', size: 100 });
    });

    it('reports a transfer the downloader still tracks', async () => {
        state.platform = 'android';
        state.status = { status: 2, bytesDownloaded: 25, bytesTotal: 100 };

        const tiles = await load();
        expect(await tiles.checkNativeTiles(asset, Date.now())).toEqual({ state: 'active', progress: 0.25 });

        state.status = { status: 16 };
        expect(await tiles.checkNativeTiles(asset, Date.now())).toEqual({ state: 'failed', message: 'Download failed' });
    });

    it('expires a download that never produced a file', async () => {
        const tiles = await load();

        expect(await tiles.checkNativeTiles(asset, Date.now() - 2 * 24 * 60 * 60 * 1000))
            .toEqual({ state: 'failed', message: 'Download expired' });
    });
});

describe('nativeTilesUrl', () => {
    it('only resolves when the file matches the recorded size', async () => {
        const tiles = await load();

        expect(await tiles.nativeTilesUrl(ID, 100)).toBeUndefined();

        state.files.set(IOS_PATH, 100);
        expect(await tiles.nativeTilesUrl(ID, 100)).toBe(`capacitor://localhost/_capacitor_file_/data/${IOS_PATH}`);

        state.files.set(IOS_PATH, 60);
        expect(await tiles.nativeTilesUrl(ID, 100)).toBeUndefined();
    });
});
