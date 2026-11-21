import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
    stamp: null as { key: string; updated: number } | null,
    rows: [] as Array<Record<string, unknown>>,
}));

vi.mock('../database.ts', () => ({
    liveQuery: vi.fn(),
    db: {
        cache: { get: vi.fn(async () => state.stamp ?? undefined) },
        overlay: {
            count: vi.fn(async () => state.rows.length),
            toArray: vi.fn(async () => [...state.rows]),
        },
        profile: { get: vi.fn(async () => undefined) },
    },
}));

const syncOverlays = vi.hoisted(() => vi.fn());
vi.mock('./overlay-sync.ts', () => ({ syncOverlays, OVERLAY_LIST_CACHE_KEY: 'overlay' }));
vi.mock('../std.js', () => ({ std: vi.fn(async () => ({})), server: {}, stdurl: vi.fn() }));
vi.mock('../std.ts', () => ({ std: vi.fn(async () => ({})), server: {}, stdurl: vi.fn() }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(async () => ({ value: null })) } }));
vi.mock('../stores/map.ts', () => ({ useMapStore: () => ({}) }));
vi.mock('../stores/map.js', () => ({ useMapStore: () => ({}) }));
vi.mock('../stores/modules/feature-visibility.ts', () => ({ FeatureVisibility: {} }));

import OverlayManager from './overlay.ts';

function row(id: number, mode: string) {
    return { id, name: `overlay-${id}`, mode, pos: id, username: 'test', visible: true };
}

beforeEach(() => {
    state.stamp = null;
    state.rows = [];
    syncOverlays.mockReset();
    syncOverlays.mockResolvedValue(undefined);
});

describe('OverlayManager.list', () => {
    it('syncs a never-synced list even when a single overlay was already written locally', async () => {
        // A sync event from another client wrote one overlay before the first full sync
        state.rows = [row(2, 'overlay')];
        syncOverlays.mockImplementation(async () => {
            state.stamp = { key: 'overlay', updated: Date.now() };
            state.rows = [row(1, 'basemap'), row(2, 'overlay')];
        });

        const list = await OverlayManager.list({ localFirst: true });

        expect(syncOverlays).toHaveBeenCalledTimes(1);
        expect(list.map((o) => o.mode)).toEqual(['basemap', 'overlay']);
    });

    it('trusts the local list once it has been fully synced', async () => {
        state.stamp = { key: 'overlay', updated: Date.now() };
        state.rows = [row(1, 'basemap')];

        const list = await OverlayManager.list({ localFirst: true });

        expect(syncOverlays).not.toHaveBeenCalled();
        expect(list).toHaveLength(1);
    });

    it('falls back to the partial local list when the first sync fails', async () => {
        state.rows = [row(2, 'overlay')];
        syncOverlays.mockRejectedValue(new Error('offline'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const list = await OverlayManager.list({ localFirst: true });

        expect(list).toHaveLength(1);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('rethrows a failed first sync when there is nothing local to fall back on', async () => {
        syncOverlays.mockRejectedValue(new Error('offline'));

        await expect(OverlayManager.list({ localFirst: true })).rejects.toThrow('offline');
    });

    it('rethrows a failed sync that was requested explicitly', async () => {
        state.stamp = { key: 'overlay', updated: Date.now() };
        state.rows = [row(1, 'basemap')];
        syncOverlays.mockRejectedValue(new Error('offline'));

        await expect(OverlayManager.list({ localFirst: true, sync: true } as never)).rejects.toThrow('offline');
    });
});
