import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import COT, { OriginMode } from '../base/cot.ts';
import type Atlas from '../workers/atlas.ts';
import type { Feature } from '../types.ts';

function feature(id: string, stale: Date, callsign = id): Feature {
    const now = new Date();
    return {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: 'a-f-G',
            how: 'm-g',
            callsign,
            time: now.toISOString(),
            start: now.toISOString(),
            stale: stale.toISOString(),
            center: [0, 0]
        },
        geometry: { type: 'Point', coordinates: [0, 0] }
    } as Feature;
}

function cot(feat: Feature): COT {
    return new COT(feat, { mode: OriginMode.CONNECTION }, { skipSave: true });
}

async function seed(atlas: AtlasDatabase, feat: Feature): Promise<COT> {
    const c = cot(feat);
    atlas.cots.set(c.id, c);
    await db.feature.put({ id: c.id, path: c.path, properties: c.properties, geometry: c.geometry });
    return c;
}

const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 60_000);

describe('AtlasDatabase feature removal', () => {
    let atlas: AtlasDatabase;

    beforeEach(async () => {
        await db.feature.clear();
        atlas = new AtlasDatabase({ profile: {} } as unknown as Atlas);
    });

    it('returns the diff before the stale rows are deleted', async () => {
        const stale = await seed(atlas, feature('stale-1', past()));
        const fresh = await seed(atlas, feature('fresh-1', future()));

        const diff = await atlas.diff();

        expect(diff.remove).toEqual([stale.vectorId()]);
        expect(atlas.cots.has(stale.id)).toBe(false);
        expect(atlas.cots.has(fresh.id)).toBe(true);

        await vi.waitFor(async () => {
            expect(await db.feature.get(stale.id)).toBeUndefined();
        });
        expect(await db.feature.get(fresh.id)).toBeDefined();
    });

    it('drains pendingDelete without awaiting the database', async () => {
        const doomed = await seed(atlas, feature('doomed-1', future()));
        atlas.pendingDelete.add(doomed.id);

        const diff = await atlas.diff();

        expect(diff.remove).toEqual([doomed.vectorId()]);
        expect(atlas.pendingDelete.size).toBe(0);
        expect(atlas.cots.has(doomed.id)).toBe(false);

        await vi.waitFor(async () => {
            expect(await db.feature.get(doomed.id)).toBeUndefined();
        });
    });

    it('does not double-delete when diff() overlaps', async () => {
        await seed(atlas, feature('stale-a', past()));
        await seed(atlas, feature('stale-b', past()));

        const bulkDelete = vi.spyOn(db.feature, 'bulkDelete');

        const [first, second] = await Promise.all([atlas.diff(), atlas.diff()]);

        expect(first.remove).toHaveLength(2);
        expect(second.remove).toHaveLength(0);
        expect(bulkDelete).toHaveBeenCalledTimes(1);

        bulkDelete.mockRestore();
    });

    it('re-persists a feature recreated while its delete is queued', async () => {
        const stale = await seed(atlas, feature('revived-1', past(), 'OLD'));

        const diff = await atlas.diff();
        expect(diff.remove).toEqual([stale.vectorId()]);

        // The create branch of add() puts a fresh COT back in memory
        const revived = cot(feature('revived-1', future(), 'NEW'));
        atlas.cots.set(revived.id, revived);

        await vi.waitFor(async () => {
            const row = await db.feature.get(revived.id);
            expect(row?.properties.callsign).toBe('NEW');
        });
    });

    it('snapshot() drops stale features from memory synchronously', async () => {
        const stale = await seed(atlas, feature('snap-stale', past()));
        const fresh = await seed(atlas, feature('snap-fresh', future()));

        const features = await atlas.snapshot();

        expect(features.map((f) => f.id)).toEqual([fresh.vectorId()]);
        expect(atlas.cots.has(stale.id)).toBe(false);

        await vi.waitFor(async () => {
            expect(await db.feature.get(stale.id)).toBeUndefined();
        });
    });
});
