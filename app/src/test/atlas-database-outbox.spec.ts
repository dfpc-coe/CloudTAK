import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
    PATCH: vi.fn(),
}));

vi.mock('../std.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../std.ts')>()),
    server,
}));

import { db, type DBFeature } from '../database.ts';
import AtlasDatabase from '../workers/atlas-database.ts';
import FeatureOutbox from '../base/feature-outbox.ts';
import { WorkerMessageType } from '../utils/events.ts';
import type Atlas from '../workers/atlas.ts';
import type { Feature, InputFeature } from '../types.ts';

function feat(id: string, remarks: string): InputFeature {
    return {
        id,
        type: 'Feature',
        path: '/',
        properties: { type: 'u-d-p', how: 'h-g-i-g-o', archived: true, callsign: id, remarks },
        geometry: { type: 'Point', coordinates: [0, 0] },
    } as unknown as InputFeature;
}

function row(id: string, remarks: string, flags: Partial<DBFeature>): DBFeature {
    const feature = feat(id, remarks);

    return {
        id,
        path: '/',
        properties: { ...feature.properties, id },
        geometry: feature.geometry,
        ...flags,
    } as unknown as DBFeature;
}

function setup() {
    const atlas = {
        token: 'token',
        postMessage: vi.fn(async () => undefined),
        profile: {
            creator: async () => ({ uid: 'me', type: 'a-f-G-E-V-C', callsign: 'ME', time: '2026-01-01T00:00:00Z' }),
        },
    } as unknown as Atlas;

    return new AtlasDatabase(atlas);
}

function archive(features: Array<Feature | InputFeature>) {
    return { data: { total: features.length, items: features } };
}

beforeEach(async () => {
    await db.feature.clear();
    FeatureOutbox.pending.clear();
    FeatureOutbox.cancelRetry();
    server.GET.mockReset();
    server.PUT.mockReset();
    server.DELETE.mockReset();
});

describe('AtlasDatabase feature outbox', () => {
    it('keeps an authored feature whose PUT failed and does not let the archive overwrite or prune it', async () => {
        server.PUT.mockRejectedValue(new TypeError('Failed to fetch'));
        const store = setup();

        await store.add(feat('a', 'local'), { authored: true });
        await FeatureOutbox.push();
        FeatureOutbox.cancelRetry();

        expect(store.cots.get('a')?.properties.remarks).toBe('local');
        expect(FeatureOutbox.isPending('a')).toBe(true);

        // The server copy is stale and must not win over the unconfirmed edit
        server.GET.mockResolvedValue(archive([feat('a', 'server')]));
        await store.loadArchive();
        expect(store.cots.get('a')?.properties.remarks).toBe('local');

        // Missing from the server is not a delete while the push is pending
        store.archiveIds.add('a');
        server.GET.mockResolvedValue(archive([]));
        await store.loadArchive();
        expect(store.cots.has('a')).toBe(true);
        expect(store.pendingDelete.has('a')).toBe(false);
    });

    it('prunes a confirmed feature the server no longer has', async () => {
        server.PUT.mockResolvedValue({ data: {} });
        const store = setup();

        await store.add(feat('a', 'local'), { authored: true });
        await FeatureOutbox.push();
        expect(FeatureOutbox.isPending('a')).toBe(false);

        store.archiveIds.add('a');
        server.GET.mockResolvedValue(archive([]));
        await store.loadArchive();

        expect(store.pendingDelete.has('a')).toBe(true);
    });

    it('ignores a server copy of a feature with a pending local edit', async () => {
        server.PUT.mockResolvedValue({ error: { message: 'offline' } });
        const store = setup();

        await store.add(feat('a', 'local'), { authored: true });
        await FeatureOutbox.push();
        FeatureOutbox.cancelRetry();

        await store.add(feat('a', 'server'), { skipSave: true });

        expect(store.cots.get('a')?.properties.remarks).toBe('local');
        expect(store.pendingUpdate.has('a')).toBe(false);
    });

    it('tombstones a delete until the API confirms it and does not resurrect it from the archive', async () => {
        server.PUT.mockResolvedValue({ data: {} });
        server.DELETE.mockResolvedValue({ error: { message: 'offline' }, response: { status: 502 } });
        const store = setup();

        await store.add(feat('a', 'local'), { authored: true });
        await FeatureOutbox.push();

        await store.remove('a');
        await FeatureOutbox.push();
        FeatureOutbox.cancelRetry();

        expect(store.pendingDelete.has('a')).toBe(true);
        expect(FeatureOutbox.isTombstone('a')).toBe(true);
        expect((await db.feature.get('a'))?.deleted).toBe(true);

        // The render diff persists removals - the tombstone row must survive it
        await store.diff();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect((await db.feature.get('a'))?.deleted).toBe(true);

        server.GET.mockResolvedValue(archive([feat('a', 'server')]));
        await store.loadArchive();
        expect(store.cots.has('a')).toBe(false);

        // A sync event for the same feature is ignored as well
        await store.add(feat('a', 'server'), { skipSave: true });
        expect(store.cots.has('a')).toBe(false);

        server.DELETE.mockResolvedValue({ data: {}, response: { status: 200 } });
        await FeatureOutbox.push();
        expect(await db.feature.get('a')).toBeUndefined();
        expect(FeatureOutbox.isPending('a')).toBe(false);
    });

    it('removes a pending edit when the user deletes it, but not when a server event does', async () => {
        server.PUT.mockRejectedValue(new TypeError('Failed to fetch'));
        const store = setup();

        await store.add(feat('a', 'local'), { authored: true });
        await store.add(feat('b', 'local'), { authored: true });
        await FeatureOutbox.push();
        FeatureOutbox.cancelRetry();

        // Another client deleted the server copy before the edit reached it - the edit wins
        await store.remove('a', { skipNetwork: true, keepPending: true });
        expect(store.pendingDelete.has('a')).toBe(false);
        expect(FeatureOutbox.isPending('a')).toBe(true);

        // The user deleted it through the API - nothing is left to resubmit
        await store.remove('b', { skipNetwork: true });
        expect(store.pendingDelete.has('b')).toBe(true);
        expect(FeatureOutbox.isPending('b')).toBe(false);

        server.PUT.mockClear();
        server.PUT.mockResolvedValue({ data: {} });
        await store.diff();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await FeatureOutbox.push();

        expect(server.PUT.mock.calls.map((call) => call[1].body.id)).toEqual(['a']);
        expect(await db.feature.get('b')).toBeUndefined();
    });

    it('announces an archived delete only once the API confirms it', async () => {
        server.PUT.mockResolvedValue({ data: {} });
        server.DELETE.mockResolvedValue({ error: { message: 'offline' }, response: { status: 502 } });
        const store = setup();
        const postMessage = store.atlas.postMessage as ReturnType<typeof vi.fn>;
        const removedCount = () => postMessage.mock.calls.filter((call) => call[0].type === WorkerMessageType.Feature_Archived_Removed).length;

        await store.add(feat('a', 'local'), { authored: true });
        await FeatureOutbox.push();

        await store.remove('a');
        await FeatureOutbox.push();
        FeatureOutbox.cancelRetry();
        expect(removedCount()).toBe(0);

        server.DELETE.mockResolvedValue({ data: {}, response: { status: 200 } });
        await FeatureOutbox.push();
        expect(removedCount()).toBe(1);
    });

    it('hydrates a pending edit but not a tombstone, and keeps both out of the prune set', async () => {
        await db.feature.bulkPut([
            row('gone', 'x', { synced: false, deleted: true }),
            row('unsent', 'local', { synced: false }),
            row('confirmed', 'server', { synced: true }),
        ]);

        const store = setup();
        await store.hydrate();

        expect(store.cots.has('gone')).toBe(false);
        expect(FeatureOutbox.isTombstone('gone')).toBe(true);
        expect(store.archiveIds.has('gone')).toBe(false);

        expect(store.cots.get('unsent')?.properties.remarks).toBe('local');
        expect(FeatureOutbox.isPending('unsent')).toBe(true);
        expect(store.archiveIds.has('unsent')).toBe(false);

        expect(store.cots.has('confirmed')).toBe(true);
        expect(store.archiveIds.has('confirmed')).toBe(true);
    });
});
