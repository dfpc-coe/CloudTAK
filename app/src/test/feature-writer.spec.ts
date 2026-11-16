import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db, suspendDatabase, resumeDatabase, takeDeferredFeatureIds } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import FeatureOutbox from '../base/feature-outbox.ts';
import FeatureWriter, { FLUSH_MS } from '../base/feature-writer.ts';
import type Atlas from '../workers/atlas.ts';
import type { InputFeature } from '../types.ts';

function feat(id: string, remarks: string): InputFeature {
    const now = Date.now();

    return {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            type: 'a-f-G',
            how: 'm-g',
            callsign: id,
            remarks,
            time: new Date(now).toISOString(),
            start: new Date(now).toISOString(),
            stale: new Date(now + 60 * 60 * 1000).toISOString(),
        },
        geometry: { type: 'Point', coordinates: [0, 0] },
    } as unknown as InputFeature;
}

function setup(): AtlasDatabase {
    const atlas = {
        token: 'token',
        postMessage: vi.fn(async () => undefined),
        profile: {
            creator: async () => ({ uid: 'me', type: 'a-f-G-E-V-C', callsign: 'ME', time: '2026-01-01T00:00:00Z' }),
        },
    } as unknown as Atlas;

    return new AtlasDatabase(atlas);
}

beforeEach(async () => {
    FeatureWriter.reset();
    await db.feature.clear();
    FeatureOutbox.pending.clear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resumeDatabase();
    takeDeferredFeatureIds();
});

describe('FeatureWriter', () => {
    it('coalesces server CoT updates into one bulkPut of the latest state', async () => {
        const store = setup();
        const bulkPut = vi.spyOn(db.feature, 'bulkPut');
        const put = vi.spyOn(db.feature, 'put');

        await store.add(feat('a', 'first'));
        await store.add(feat('a', 'second'));
        await store.add(feat('b', 'only'));

        // Nothing is written on the CoT's own path
        expect(put).not.toHaveBeenCalled();
        expect(await db.feature.get('a')).toBeUndefined();

        await FeatureWriter.flush();

        expect(bulkPut).toHaveBeenCalledTimes(1);
        expect(bulkPut.mock.calls[0][0]).toHaveLength(2);
        expect((await db.feature.get('a'))?.properties.remarks).toBe('second');
        expect((await db.feature.get('b'))?.properties.remarks).toBe('only');
    });

    it('flushes on its own after FLUSH_MS', async () => {
        vi.useFakeTimers();
        const store = setup();
        const flush = vi.spyOn(FeatureWriter, 'flush');

        await store.add(feat('a', 'first'));
        await store.add(feat('a', 'second'));
        expect(flush).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(FLUSH_MS);

        expect(flush).toHaveBeenCalledTimes(1);
    });

    it('never writes back a feature removed before the flush', async () => {
        const store = setup();

        await store.add(feat('a', 'first'));
        await store.remove('a');
        await store.diff();

        await FeatureWriter.flush();

        expect(await db.feature.get('a')).toBeUndefined();
    });

    it('skips a queued COT that was replaced in memory', async () => {
        const store = setup();

        await store.add(feat('a', 'first'));
        const queued = store.cots.get('a');
        store.cots.delete('a');

        await FeatureWriter.flush();

        expect(queued).toBeDefined();
        expect(await db.feature.get('a')).toBeUndefined();
    });

    it('defers queued writes while the database is suspended and persists them on resume', async () => {
        const store = setup();

        await store.add(feat('a', 'first'));

        suspendDatabase();
        await FeatureWriter.flush();
        resumeDatabase();

        expect(await db.feature.get('a')).toBeUndefined();

        expect(await store.flushDeferred()).toBe(1);
        expect((await db.feature.get('a'))?.properties.remarks).toBe('first');
    });

    it('still writes authored archived features through the outbox immediately', async () => {
        const store = setup();
        const authored = feat('mine', 'local');
        authored.properties.archived = true;

        vi.spyOn(FeatureOutbox, 'push').mockResolvedValue(true);

        await store.add(authored, { authored: true });

        expect((await db.feature.get('mine'))?.synced).toBe(false);
        expect(FeatureWriter.pending.has('mine')).toBe(false);
    });
});
