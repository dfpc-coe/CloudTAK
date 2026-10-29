import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import FeatureOutbox from '../base/feature-outbox.ts';
import FeatureWriter from '../base/feature-writer.ts';
import { WorkerMessageType } from '../utils/events.ts';
import type Atlas from '../workers/atlas.ts';
import type { InputFeature } from '../types.ts';

function point(id: string, callsign = id): InputFeature {
    const now = Date.now();

    return {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            type: 'u-d-p',
            how: 'm-g',
            callsign,
            archived: true,
            time: new Date(now).toISOString(),
            start: new Date(now).toISOString(),
            stale: new Date(now + 60 * 60 * 1000).toISOString(),
        },
        geometry: { type: 'Point', coordinates: [1, 2] },
    } as unknown as InputFeature;
}

/**
 * A store whose postMessage and outbox writes log into one ordered list,
 * with the hook run on every Feature_Render nudge so a test can see the
 * in-memory state the page would diff at that moment
 */
function setup(onRender?: (store: AtlasDatabase) => void) {
    const order: string[] = [];

    // eslint-disable-next-line prefer-const
    let store: AtlasDatabase;

    const atlas = {
        token: 'token',
        postMessage: vi.fn(async (msg: { type: string }) => {
            order.push(msg.type);
            if (msg.type === WorkerMessageType.Feature_Render && onRender) onRender(store);
        }),
        profile: {
            creator: async () => ({ uid: 'me', type: 'a-f-G-E-V-C', callsign: 'ME', time: '2026-01-01T00:00:00Z' }),
        },
    } as unknown as Atlas;

    const queue = FeatureOutbox.queue.bind(FeatureOutbox);
    vi.spyOn(FeatureOutbox, 'queue').mockImplementation(async (feat) => {
        order.push('outbox.queue');
        await queue(feat);
    });

    const tombstone = FeatureOutbox.tombstone.bind(FeatureOutbox);
    vi.spyOn(FeatureOutbox, 'tombstone').mockImplementation(async (feat) => {
        order.push('outbox.tombstone');
        await tombstone(feat);
    });

    vi.spyOn(FeatureOutbox, 'push').mockResolvedValue(true);

    store = new AtlasDatabase(atlas);

    return { store, atlas, order };
}

beforeEach(async () => {
    FeatureWriter.reset();
    await db.feature.clear();
    FeatureOutbox.pending.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AtlasDatabase local render', () => {
    it('nudges the page to diff a dropped point before its outbox write', async () => {
        let queued = false;
        const { store, order } = setup((s) => {
            queued = s.pendingCreate.has('drop');
        });

        await store.add(point('drop'), { authored: true, skipMissionLookup: true });

        expect(order.indexOf(WorkerMessageType.Feature_Render)).toBeLessThan(order.indexOf('outbox.queue'));
        expect(queued).toBe(true);
    });

    it('nudges for an authored edit of an existing point', async () => {
        let updated = false;
        const { store, order } = setup((s) => {
            updated = s.pendingUpdate.has('edit');
        });

        await store.add(point('edit'), { authored: true, skipMissionLookup: true });
        await store.diff();
        order.length = 0;

        await store.add(point('edit', 'renamed'), { authored: true });

        expect(order[0]).toBe(WorkerMessageType.Feature_Render);
        expect(updated).toBe(true);
    });

    it('does not nudge for server CoTs', async () => {
        const { store, atlas } = setup();
        const server = point('remote');
        server.properties.archived = false;

        await store.add(server);

        const types = vi.mocked(atlas.postMessage).mock.calls.map(([msg]) => msg.type);
        expect(types).not.toContain(WorkerMessageType.Feature_Render);
    });

    it('takes a deleted point off the map before its tombstone is written', async () => {
        let removing: boolean | undefined;
        const { store, order } = setup((s) => {
            if (s.pendingDelete.size) removing = s.pendingDelete.has('gone');
        });

        await store.add(point('gone'), { authored: true, skipMissionLookup: true });
        await store.diff();
        order.length = 0;

        await store.remove('gone');

        expect(removing).toBe(true);
        expect(order.indexOf(WorkerMessageType.Feature_Render)).toBeLessThan(order.indexOf('outbox.tombstone'));
    });

    it('keeps the tombstone when the nudged diff runs before it is written', async () => {
        const diffs: Promise<unknown>[] = [];
        const { store } = setup((s) => {
            // The page diffs as soon as the nudge arrives
            diffs.push(s.diff());
        });

        await store.add(point('raced'), { authored: true, skipMissionLookup: true });
        await Promise.all(diffs);
        diffs.length = 0;

        await store.remove('raced');
        await Promise.all(diffs);
        // persistRemoval runs in the background off the diff
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(store.cots.has('raced')).toBe(false);
        expect((await db.feature.get('raced'))?.deleted).toBe(true);
        expect(FeatureOutbox.isTombstone('raced')).toBe(true);
    });
});
