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

function stub(id: number, pos: number, mode = 'profile', type = 'vector'): StubOverlay {
    return {
        id, name: `Overlay ${id}`, pos, mode, type,
        _internal: mode === 'internal',
        save: vi.fn(async () => {}),
        moveBefore: vi.fn(),
    } as unknown as StubOverlay;
}

/**
 * A 3D Tiles overlay (deck.gl, `styles: []`) has no MapLibre layers, so it
 * can never anchor a moveLayer() call: the overlay below it has to be moved
 * before the next overlay that does have layers.
 */
describe('OverlayManager stack order next to a 3D Tiles overlay', () => {
    let basemap: StubOverlay;
    let tiles: StubOverlay;
    let a: StubOverlay;
    let b: StubOverlay;
    let features: StubOverlay;

    beforeEach(() => {
        OverlayManager.clearLoaded();

        basemap = stub(10, -1, 'basemap', 'raster');
        a = stub(1, 0);
        tiles = stub(2, 1, 'ion', '3dtiles');
        b = stub(3, 2);
        features = stub(-1, 3, 'internal', 'geojson');

        OverlayManager.appendLoaded(basemap, a, tiles, b, features);
    });

    it('loadedLayerAnchor skips 3D Tiles overlays', () => {
        expect(OverlayManager.loadedLayerAnchor(2)).toBe(b);
        expect(OverlayManager.loadedLayerAnchor(3)).toBe(b);
        expect(OverlayManager.loadedLayerAnchor(5)).toBeUndefined();
    });

    it('applyLoadedOrder anchors the overlay below a 3D Tiles overlay to the next one with layers', () => {
        OverlayManager.applyLoadedOrder();

        expect(a.moveBefore).toHaveBeenCalledWith(b);
        expect(basemap.moveBefore).toHaveBeenCalledWith(a);
        expect(features.moveBefore).toHaveBeenCalledWith(undefined);
    });

    it('reorderLoaded skips a 3D Tiles overlay dropped right above the moved one', async () => {
        await OverlayManager.reorderLoaded([10, 3, 1, 2, -1], 1);

        expect(a.moveBefore).toHaveBeenLastCalledWith(features);

        await OverlayManager.reorderLoaded([10, 1, 2, 3, -1], 1);

        expect(a.moveBefore).toHaveBeenLastCalledWith(b);
    });
});
