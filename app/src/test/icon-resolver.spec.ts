import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const Icon = vi.hoisted(() => ({
    get: vi.fn(),
    fetchRemote: vi.fn(),
}));

vi.mock('maplibre-gl', () => ({ addProtocol: vi.fn() }));
vi.mock('../base/icon.ts', () => ({ default: Icon }));
vi.mock('../base/iconset.ts', () => ({ default: {} }));
vi.mock('../std.ts', () => ({ stdurl: (url: string) => url }));
vi.mock('../utils/milsymbol.ts', () => ({ isMilsymIcon: () => false, symbolCanvas: vi.fn() }));

import IconManager from '../stores/modules/icons.ts';
import type { Map as MapLibreMap } from 'maplibre-gl';

type FakeImage = { data: { data: Uint8ClampedArray, width: number, height: number } };

class FakeImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
}

vi.stubGlobal('ImageData', FakeImageData);
vi.stubGlobal('createImageBitmap', async (source: unknown) => ({
    source,
    data: { data: new Uint8ClampedArray([255, 255, 255, 255]), width: 1, height: 1 }
}));

function fakeMap() {
    const images = new Map<string, FakeImage>();
    const removed: string[] = [];

    const map = {
        images,
        removed,
        setMissingStyleImageResolver: vi.fn(),
        hasImage: (id: string) => images.has(id),
        addImage: (id: string, image: FakeImage) => { images.set(id, image); },
        removeImage: (id: string) => { removed.push(id); images.delete(id); },
        getImage: (id: string) => images.get(id),
        listImages: () => [...images.keys()],
    };

    return map as unknown as MapLibreMap & typeof map;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

beforeEach(() => {
    Icon.get.mockReset();
    Icon.fetchRemote.mockReset();
    Icon.get.mockResolvedValue(undefined);
});

describe('IconManager missing image resolver', () => {
    it('registers a placeholder immediately and swaps in the icon once the fetch completes', async () => {
        const map = fakeMap();
        const manager = new IconManager(map);
        const remote = deferred<Blob | undefined>();
        Icon.fetchRemote.mockReturnValue(remote.promise);

        await manager.resolve('set:icon');

        expect(map.hasImage('set:icon')).toBe(true);
        const placeholder = map.images.get('set:icon');
        expect(Icon.fetchRemote).toHaveBeenCalledWith('set:icon');

        const blob = new Blob(['png'], { type: 'image/png' });
        remote.resolve(blob);

        await vi.waitFor(() => {
            expect(map.images.get('set:icon')).not.toBe(placeholder);
        });

        expect((map.images.get('set:icon') as unknown as { source: Blob }).source).toBe(blob);
        expect(map.removed).toEqual(['set:icon']);
    });

    it('keeps the placeholder when the icon cannot be fetched and does not refetch per tile', async () => {
        const map = fakeMap();
        const manager = new IconManager(map);
        Icon.fetchRemote.mockResolvedValue(undefined);

        await manager.resolve('set:missing');
        await manager.resolve('set:missing');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(map.hasImage('set:missing')).toBe(true);
        expect(Icon.fetchRemote).toHaveBeenCalledTimes(1);
        expect(map.removed).toEqual([]);
    });

    it('drops recolored variants derived from the placeholder when the real icon arrives', async () => {
        const map = fakeMap();
        const manager = new IconManager(map);
        const remote = deferred<Blob | undefined>();
        Icon.fetchRemote.mockReturnValue(remote.promise);

        await manager.resolve('set:icon-colored-ff0000');

        expect(map.hasImage('set:icon')).toBe(true);
        expect(map.hasImage('set:icon-colored-ff0000')).toBe(true);

        remote.resolve(new Blob(['png'], { type: 'image/png' }));

        await vi.waitFor(() => {
            expect(map.hasImage('set:icon-colored-ff0000')).toBe(false);
        });

        expect(map.removed).toEqual(['set:icon', 'set:icon-colored-ff0000']);
    });

    it('serves a cached icon without a network request', async () => {
        const map = fakeMap();
        const manager = new IconManager(map);
        const blob = new Blob(['png'], { type: 'image/png' });
        Icon.get.mockResolvedValue({ data: blob });

        await manager.resolve('set:cached');

        expect((map.images.get('set:cached') as unknown as { source: Blob }).source).toBe(blob);
        expect(Icon.fetchRemote).not.toHaveBeenCalled();
    });
});
