import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addProtocol = vi.hoisted(() => vi.fn());

vi.mock('maplibre-gl', () => ({ addProtocol }));
vi.mock('../std.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../std.ts')>()),
    stdurl: (url: string) => new URL(url, 'http://localhost:5001'),
    getRuntimeToken: async () => 'tok',
}));

import { db } from '../database.ts';
import GlyphManager from '../stores/modules/glyphs.ts';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

GlyphManager.registerProtocol();
const handler = addProtocol.mock.calls[0][1] as (params: { url: string }) => Promise<{ data: ArrayBuffer }>;

function pbf(byte: number): Response {
    return new Response(new Uint8Array([byte, byte, byte]), { status: 200 });
}

beforeEach(async () => {
    await db.glyph.clear();
    fetchMock.mockReset();
});

describe('GlyphManager', () => {
    it('routes the style glyph template through the protocol', () => {
        expect(GlyphManager.glyphsUrl()).toBe('cloudtak-glyphs://{fontstack}/{range}.pbf');
        expect(handler).toBeInstanceOf(Function);
    });

    it('serves the bundled Open Sans Bold range 0 without touching the API', async () => {
        fetchMock.mockImplementation(async (input: string) => {
            expect(String(input)).not.toContain('/api/fonts');
            return pbf(1);
        });

        const first = await GlyphManager.load('Open Sans Bold', '0-255');
        const second = await GlyphManager.load('Open Sans Bold', '0-255');

        expect(new Uint8Array(first)).toEqual(new Uint8Array([1, 1, 1]));
        expect(new Uint8Array(second)).toEqual(new Uint8Array([1, 1, 1]));
        expect(first).not.toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('fetches other ranges from the API once and serves them from Dexie afterwards', async () => {
        fetchMock.mockResolvedValue(pbf(2));

        const first = await GlyphManager.load('Open Sans Bold', '256-511');
        expect(new Uint8Array(first)).toEqual(new Uint8Array([2, 2, 2]));

        const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        expect(String(url)).toBe('http://localhost:5001/api/fonts/Open%20Sans%20Bold/256-511.pbf');
        expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
        expect(init.signal).toBeInstanceOf(AbortSignal);

        fetchMock.mockReset();
        const second = await GlyphManager.load('Open Sans Bold', '256-511');
        expect(new Uint8Array(second)).toEqual(new Uint8Array([2, 2, 2]));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a failed API response so MapLibre falls back to locally drawn glyphs', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

        await expect(GlyphManager.load('Noto Sans Regular', '0-255')).rejects.toThrow('404');
        expect(await db.glyph.get('Noto Sans Regular/0-255')).toBeUndefined();
    });

    it('decodes the fontstack from the protocol URL', async () => {
        fetchMock.mockResolvedValue(pbf(3));

        const { data } = await handler({ url: 'cloudtak-glyphs://Noto%20Sans%20Bold/512-767.pbf' });

        expect(new Uint8Array(data)).toEqual(new Uint8Array([3, 3, 3]));
        expect(String(fetchMock.mock.calls[0][0])).toBe('http://localhost:5001/api/fonts/Noto%20Sans%20Bold/512-767.pbf');
    });
});
