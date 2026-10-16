import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GET = vi.hoisted(() => vi.fn());

vi.mock('../std.ts', () => ({ server: { GET }, bearer: () => undefined, stdurl: (url: string) => url }));

import { db } from '../database.ts';
import COT from './cot.ts';

function ok(data: unknown) {
    return { data, error: undefined };
}

describe('COT.resolveType', () => {
    beforeEach(async () => {
        await db.taxonomy.clear();
    });

    afterEach(() => {
        GET.mockReset();
        vi.restoreAllMocks();
    });

    it('fetches an unknown CoT type and caches it', async () => {
        GET.mockResolvedValue(ok({ cot: 'a-f-G-U-C', full: 'Friendly Ground Unit Combat', desc: 'Combat unit' }));

        const resolved = await COT.resolveType('a-f-G-U-C');

        expect(resolved).toEqual({ type: 'a-f-G-U-C', name: 'Friendly Ground Unit Combat', desc: 'Combat unit' });
        expect(GET).toHaveBeenCalledTimes(1);
        expect(GET).toHaveBeenCalledWith('/api/type/cot/{:type}', { params: { path: { ':type': 'a-f-G-U-C' } } });
        expect(await db.taxonomy.get('a-f-G-U-C')).toEqual(resolved);
    });

    it('serves a cached type without a network call', async () => {
        await db.taxonomy.put({ type: 'u-d-p', name: 'Point', desc: 'A point' });

        expect(await COT.resolveType('u-d-p')).toEqual({ type: 'u-d-p', name: 'Point', desc: 'A point' });
        expect(GET).not.toHaveBeenCalled();
    });

    it('returns the type itself when the request fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        GET.mockRejectedValue(new TypeError('Failed to fetch'));

        expect(await COT.resolveType('a-h-A')).toEqual({ type: 'a-h-A', name: 'a-h-A', desc: '' });
        expect(await db.taxonomy.get('a-h-A')).toBeUndefined();
    });

    it('returns the type itself on an API error response', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        GET.mockResolvedValue({ data: undefined, error: { message: 'Internal Server Error' } });

        expect(await COT.resolveType('a-h-A')).toEqual({ type: 'a-h-A', name: 'a-h-A', desc: '' });
        expect(await db.taxonomy.get('a-h-A')).toBeUndefined();
    });

    it('does not cache a type the server does not know', async () => {
        GET.mockResolvedValue(ok({ cot: 'x-y-z', full: 'x-y-z', desc: 'Unknown CoT Type' }));

        expect(await COT.resolveType('x-y-z')).toEqual({ type: 'x-y-z', name: 'x-y-z', desc: '' });
        expect(await db.taxonomy.get('x-y-z')).toBeUndefined();
    });

    it('resolves a 2525E SIDC through the symbol endpoint', async () => {
        GET.mockResolvedValue(ok({ sidc: '10031000001211000000', name: 'Infantry', remarks: 'Land unit' }));

        const resolved = await COT.resolveType('10031000001211000000');

        expect(GET).toHaveBeenCalledWith('/api/type/2525e/{:sidc}', { params: { path: { ':sidc': '10031000001211000000' } } });
        expect(resolved).toEqual({ type: '10031000001211000000', name: 'Infantry', desc: 'Land unit' });
    });

    it('shares one in-flight request between concurrent callers', async () => {
        let release: (value: unknown) => void = () => undefined;
        GET.mockReturnValue(new Promise((resolve) => { release = resolve; }));

        const first = COT.resolveType('a-n-G');
        const second = COT.resolveType('a-n-G');

        release(ok({ cot: 'a-n-G', full: 'Neutral Ground', desc: '' }));

        expect(await first).toEqual(await second);
        expect(GET).toHaveBeenCalledTimes(1);
    });

    it('is available on an instance', async () => {
        await db.taxonomy.put({ type: 'b-m-p-s-m', name: 'Spot Map', desc: '' });

        const cot = new COT({
            id: 'test',
            type: 'Feature',
            properties: { id: 'test', type: 'b-m-p-s-m' },
            geometry: { type: 'Point', coordinates: [0, 0] }
        } as never, { mode: 'Mission' } as never, { skipSave: true });

        expect((await cot.resolveType()).name).toBe('Spot Map');
    });
});
