import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import Subscription from '../base/subscription.ts';
import { renderMissionFeature } from '../base/subscription-feature.ts';
import { WorkerMessageType } from '../utils/events.ts';
import type Atlas from '../workers/atlas.ts';
import type { InputFeature } from '../types.ts';

const GUID = 'mission-guid';

function point(id: string): InputFeature {
    const now = Date.now();

    return {
        id,
        type: 'Feature',
        path: '/',
        properties: {
            type: 'u-d-p',
            how: 'm-g',
            callsign: id,
            archived: true,
            time: new Date(now).toISOString(),
            start: new Date(now).toISOString(),
            stale: new Date(now + 60 * 60 * 1000).toISOString(),
        },
        geometry: { type: 'Point', coordinates: [1, 2] },
    } as unknown as InputFeature;
}

/**
 * A store whose atlas, Subscription.from and Mission feature writes all log
 * into one ordered list, so a test can assert what happened before the
 * IndexedDB work of a Mission edit
 */
function setup(updateGate?: Promise<void>) {
    const order: string[] = [];

    const atlas = {
        token: 'token',
        postMessage: vi.fn(async (msg: { type: string }) => {
            order.push(msg.type);
        }),
        profile: {
            creator: async () => ({ uid: 'me', type: 'a-f-G-E-V-C', callsign: 'ME', time: '2026-01-01T00:00:00Z' }),
        },
    } as unknown as Atlas;

    const sub = {
        feature: {
            update: vi.fn(async () => {
                if (updateGate) await updateGate;
                order.push('feature.update');
            }),
            delete: vi.fn(async () => { order.push('feature.delete'); }),
        },
    };

    vi.spyOn(Subscription, 'from').mockImplementation(async () => {
        order.push('Subscription.from');
        return sub as unknown as Subscription;
    });

    const store = new AtlasDatabase(atlas);
    store.mission = GUID;

    return { store, atlas, sub, order };
}

beforeEach(async () => {
    await db.subscription_feature.clear();
    await db.subscription.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AtlasDatabase Mission render', () => {
    it('posts a dropped point to its overlay before any Mission IndexedDB work', async () => {
        const { store, atlas, sub, order } = setup();

        await store.add(point('drop'), { authored: true, skipMissionLookup: true });

        expect(order).toEqual([
            WorkerMessageType.Mission_Render_Feature,
            'Subscription.from',
            'feature.update',
            WorkerMessageType.Mission_Change_Feature,
        ]);

        const render = vi.mocked(atlas.postMessage).mock.calls[0][0];
        expect(render.body.guid).toBe(GUID);
        expect(render.body.add.id).toBe('drop');
        expect(render.body.add.geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
        expect(sub.feature.update).toHaveBeenCalledTimes(1);
    });

    it('does not render optimistically when the caller turns render off', async () => {
        const { store, atlas } = setup();

        await store.add(point('quiet'), { authored: true, skipMissionLookup: true, render: false });

        const types = vi.mocked(atlas.postMessage).mock.calls.map(([msg]) => msg.type);
        expect(types).not.toContain(WorkerMessageType.Mission_Render_Feature);
    });

    it('takes a deleted Mission feature off its overlay before the delete is written', async () => {
        const { store, atlas, order } = setup();
        const feat = point('gone');

        await db.subscription.put({ guid: GUID, subscribed: true } as never);
        await db.subscription_feature.put({
            id: 'gone',
            mission: GUID,
            path: '/',
            properties: feat.properties,
            geometry: feat.geometry,
            synced: true,
            deleted: false,
            attempts: 0,
        } as never);

        await store.remove('gone', { mission: true });

        expect(order).toEqual([
            WorkerMessageType.Mission_Render_Feature,
            'Subscription.from',
            'feature.delete',
            WorkerMessageType.Mission_Change_Feature,
        ]);
        expect(vi.mocked(atlas.postMessage).mock.calls[0][0].body).toEqual({ guid: GUID, remove: 'gone' });
    });

    it('skips the Mission lookup read for a freshly created id', async () => {
        const { store } = setup();
        const get = vi.spyOn(db.subscription_feature, 'get');

        await store.add(point('fresh'), { authored: true, skipMissionLookup: true });
        expect(get).not.toHaveBeenCalled();

        await store.add(point('looked-up'), { authored: true });
        expect(get).toHaveBeenCalledWith('looked-up');
    });

    it('keeps a dropped Mission point findable by id until its write lands', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const { store } = setup(gate);
        const read = vi.spyOn(db.subscription_feature, 'get');

        const adding = store.add(point('drop'), { authored: true, skipMissionLookup: true });
        await vi.waitFor(() => expect(store.missionWrites.has('drop')).toBe(true));

        // The click path - answered from memory, not IndexedDB
        const found = await store.get('drop', { mission: true });
        expect(found?.id).toBe('drop');
        expect(found?.origin).toEqual({ mode: 'Mission', mode_id: GUID });
        expect(read).not.toHaveBeenCalled();

        release();
        await adding;

        expect(store.missionWrites.has('drop')).toBe(false);
    });

    it('releases the in-memory copy when the write fails', async () => {
        const { store } = setup();
        vi.mocked(Subscription.from).mockResolvedValue(undefined);

        await expect(store.add(point('orphan'), { authored: true, skipMissionLookup: true })).rejects.toThrow(/not loaded/);

        expect(store.missionWrites.has('orphan')).toBe(false);
    });

    it('holds a delete until the drop it removes has been written', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const { store, order } = setup(gate);

        const adding = store.add(point('quick'), { authored: true, skipMissionLookup: true });
        await vi.waitFor(() => expect(store.missionWrites.has('quick')).toBe(true));

        const removing = store.remove('quick', { mission: true });
        await vi.waitFor(() => expect(order.filter((step) => step === 'Subscription.from')).toHaveLength(2));
        expect(order).not.toContain('feature.delete');

        release();
        await Promise.all([adding, removing]);

        expect(order.indexOf('feature.update')).toBeLessThan(order.indexOf('feature.delete'));
    });

    it('lists in-flight edits so a full overlay render keeps them', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const { store } = setup(gate);

        const adding = store.add(point('drop'), { authored: true, skipMissionLookup: true });
        await vi.waitFor(() => expect(store.missionWrites.has('drop')).toBe(true));

        store.missionRemoves.set('gone', GUID);
        store.missionRemoves.set('elsewhere', 'other-guid');

        const pending = store.missionPending(GUID);
        expect(pending.add.map((feat) => feat.id)).toEqual(['drop']);
        expect(pending.remove).toEqual(['gone']);

        release();
        await adding;

        expect(store.missionPending(GUID).add).toEqual([]);
    });

    it('repaints the overlay when an optimistically drawn add fails', async () => {
        const { store, order } = setup();
        vi.mocked(Subscription.from).mockImplementation(async () => {
            order.push('Subscription.from');
            return undefined;
        });

        await expect(store.add(point('orphan'), { authored: true, skipMissionLookup: true })).rejects.toThrow(/not loaded/);

        expect(order).toEqual([
            WorkerMessageType.Mission_Render_Feature,
            'Subscription.from',
            WorkerMessageType.Mission_Change_Feature,
        ]);
    });

    it('repaints the overlay when an optimistically drawn delete fails', async () => {
        const { store, order } = setup();
        const feat = point('stuck');

        await db.subscription.put({ guid: GUID, subscribed: true } as never);
        await db.subscription_feature.put({
            id: 'stuck',
            mission: GUID,
            path: '/',
            properties: feat.properties,
            geometry: feat.geometry,
            synced: true,
            deleted: false,
            attempts: 0,
        } as never);

        vi.mocked(Subscription.from).mockImplementation(async () => {
            order.push('Subscription.from');
            return undefined;
        });

        await expect(store.remove('stuck', { mission: true })).rejects.toThrow(/does not exist/);

        expect(order).toEqual([
            WorkerMessageType.Mission_Render_Feature,
            'Subscription.from',
            WorkerMessageType.Mission_Change_Feature,
        ]);
        expect(store.missionRemoves.has('stuck')).toBe(false);
    });
});

describe('renderMissionFeature', () => {
    it('adds the overlay path and keeps the feature id and geometry', () => {
        const feat = point('styled');
        feat.path = '/folder/';

        const rendered = renderMissionFeature({ ...feat, properties: { ...feat.properties, id: 'styled' } } as never);

        expect(rendered.id).toBe('styled');
        expect(rendered.properties.path).toBe('/folder/');
        expect(rendered.geometry).toEqual(feat.geometry);
    });
});
