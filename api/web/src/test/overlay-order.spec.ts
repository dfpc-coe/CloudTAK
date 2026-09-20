import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../std.ts', () => ({ server: {} }));
vi.mock('../base/overlay-class.ts', () => ({ default: class {} }));
vi.mock('../base/overlay-sync.ts', () => ({
    syncOverlays: vi.fn(),
    OVERLAY_LIST_CACHE_KEY: 'overlay'
}));

import OverlayManager from '../base/overlay.ts';
import type Overlay from '../base/overlay-class.ts';

type StubOverlay = Overlay & {
    save: ReturnType<typeof vi.fn>;
    moveBefore: ReturnType<typeof vi.fn>;
};

function stub(id: number, name: string, pos: number, mode = 'profile'): StubOverlay {
    return {
        id, name, pos, mode,
        _internal: mode === 'internal',
        save: vi.fn(async () => {}),
        moveBefore: vi.fn(),
    } as unknown as StubOverlay;
}

function ids(): number[] {
    return OverlayManager.loaded.map((overlay) => overlay.id);
}

describe('OverlayManager stack order', () => {
    let basemap: StubOverlay;
    let features: StubOverlay;
    let ordinary: StubOverlay[];

    beforeEach(() => {
        OverlayManager.clearLoaded();

        basemap = stub(10, 'Basemap', -1, 'basemap');
        features = stub(-1, 'Map Features', 3, 'internal');
        ordinary = [1, 2, 3, 4, 5].map((id) => stub(id, `Overlay ${id}`, id));

        OverlayManager.appendLoaded(basemap, ...ordinary, features);
    });

    it('reorderLoaded leaves pinned overlays untouched', async () => {
        await OverlayManager.reorderLoaded([10, 2, 1, 3, 4, 5, -1], 2);

        expect(basemap.pos).toBe(-1);
        expect(features.pos).toBe(3);
        expect(basemap.save).not.toHaveBeenCalled();
        expect(features.save).not.toHaveBeenCalled();

        expect(ids()).toEqual([10, 2, 1, 3, 4, 5, -1]);
        expect(ordinary[1].save).toHaveBeenCalledTimes(1);
        expect(ordinary[1].moveBefore).toHaveBeenCalledWith(ordinary[0]);
    });

    it('reorderLoaded refuses to move a pinned overlay', async () => {
        await expect(OverlayManager.reorderLoaded([1, 10, 2, 3, 4, 5, -1], 10)).rejects.toThrow('fixed');
        expect(ids()).toEqual([10, 1, 2, 3, 4, 5, -1]);
    });

    it('reorderLoaded cannot drop an overlay beyond a pinned one', async () => {
        await OverlayManager.reorderLoaded([1, 10, 2, 3, 4, 5, -1], 1);

        expect(ids()[0]).toBe(10);
        expect(ids()[ids().length - 1]).toBe(-1);
        expect(ordinary[0].moveBefore).toHaveBeenCalledWith(OverlayManager.loaded[2]);
    });

    it('compareStack pins by overlay kind even when pos is corrupted', () => {
        basemap.pos = 4;
        features.pos = 0;

        OverlayManager.loaded.sort(OverlayManager.compareStack);

        expect(ids()).toEqual([10, 1, 2, 3, 4, 5, -1]);
    });
});
