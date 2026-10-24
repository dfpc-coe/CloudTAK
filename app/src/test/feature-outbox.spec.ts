import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
}));

vi.mock('../std.ts', () => ({ server }));

import { db } from '../database.ts';
import FeatureOutbox, { OutboxState } from '../base/feature-outbox.ts';
import type { Feature } from '../types.ts';

function feat(id: string, remarks = 'local'): Feature {
    return {
        id,
        type: 'Feature',
        path: '/',
        properties: { id, type: 'u-d-p', archived: true, remarks },
        geometry: { type: 'Point', coordinates: [0, 0] },
    } as unknown as Feature;
}

beforeEach(async () => {
    await db.feature.clear();
    FeatureOutbox.pending.clear();
    FeatureOutbox.cancelRetry();
    server.PUT.mockReset();
    server.DELETE.mockReset();
});

describe('FeatureOutbox', () => {
    it('persists a queued feature as pending and confirms it after a successful PUT', async () => {
        server.PUT.mockResolvedValue({ data: {} });

        await FeatureOutbox.queue(feat('a'));
        expect(FeatureOutbox.isPending('a')).toBe(true);
        expect((await db.feature.get('a'))?.synced).toBe(false);

        expect(await FeatureOutbox.push()).toBe(true);

        const row = await db.feature.get('a');
        expect(row?.synced).toBe(true);
        expect(row?.properties.remarks).toBe('local');
        expect(FeatureOutbox.isPending('a')).toBe(false);
        expect(server.PUT).toHaveBeenCalledTimes(1);
        expect(server.PUT.mock.calls[0][1].body).toMatchObject({ id: 'a', properties: { remarks: 'local' } });
    });

    it('keeps the row pending and records the failure when the API rejects it', async () => {
        server.PUT.mockResolvedValue({ error: { message: 'boom' } });

        await FeatureOutbox.queue(feat('a'));
        expect(await FeatureOutbox.push()).toBe(false);

        const row = await db.feature.get('a');
        expect(row?.synced).toBe(false);
        expect(row?.attempts).toBe(1);
        expect(row?.error).toBe('boom');
        expect(FeatureOutbox.isPending('a')).toBe(true);

        FeatureOutbox.cancelRetry();
    });

    it('stops the flush after a transport failure so the queue is not drained against a dead link', async () => {
        server.PUT.mockRejectedValue(new TypeError('Failed to fetch'));

        await db.feature.bulkPut([
            { ...rowOf(feat('a')), synced: false, attempts: 0 },
            { ...rowOf(feat('b')), synced: false, attempts: 0 },
        ]);
        await FeatureOutbox.load();

        expect(await FeatureOutbox.push()).toBe(false);

        expect(server.PUT).toHaveBeenCalledTimes(1);
        expect((await db.feature.get('a'))?.attempts).toBe(1);
        expect((await db.feature.get('b'))?.attempts).toBe(0);
        expect(FeatureOutbox.isPending('b')).toBe(true);

        FeatureOutbox.cancelRetry();
    });

    it('resubmits a row edited while its request was in flight instead of confirming the stale copy', async () => {
        server.PUT.mockImplementationOnce(async () => {
            await FeatureOutbox.queue(feat('a', 'edited'));
            return { data: {} };
        });
        server.PUT.mockResolvedValue({ data: {} });

        await FeatureOutbox.queue(feat('a'));
        expect(await FeatureOutbox.push()).toBe(true);

        expect(server.PUT).toHaveBeenCalledTimes(2);
        expect(server.PUT.mock.calls[0][1].body.properties.remarks).toBe('local');
        expect(server.PUT.mock.calls[1][1].body.properties.remarks).toBe('edited');

        const row = await db.feature.get('a');
        expect(row?.synced).toBe(true);
        expect(row?.properties.remarks).toBe('edited');
        expect(FeatureOutbox.isPending('a')).toBe(false);
    });

    it('drops a tombstone once the server confirms the delete or no longer has the feature', async () => {
        server.DELETE.mockResolvedValue({ error: { message: 'Not Found' }, response: { status: 404 } });

        await FeatureOutbox.tombstone(feat('a'));
        expect(FeatureOutbox.isTombstone('a')).toBe(true);
        expect((await db.feature.get('a'))?.deleted).toBe(true);

        expect(await FeatureOutbox.push()).toBe(true);

        expect(await db.feature.get('a')).toBeUndefined();
        expect(FeatureOutbox.isPending('a')).toBe(false);
    });

    it('restores pending state from Dexie', async () => {
        await db.feature.bulkPut([
            { ...rowOf(feat('up')), synced: false },
            { ...rowOf(feat('gone')), synced: false, deleted: true },
            { ...rowOf(feat('ok')), synced: true },
        ]);

        await FeatureOutbox.load();

        expect(FeatureOutbox.pending.get('up')).toBe(OutboxState.Upsert);
        expect(FeatureOutbox.pending.get('gone')).toBe(OutboxState.Delete);
        expect(FeatureOutbox.isPending('ok')).toBe(false);

        expect(FeatureOutbox.row(feat('up')).synced).toBe(false);
        expect(FeatureOutbox.row(feat('gone')).deleted).toBe(true);
        expect(FeatureOutbox.row(feat('ok')).synced).toBeUndefined();
    });
});

function rowOf(feature: Feature) {
    return {
        id: feature.id,
        path: feature.path,
        properties: feature.properties,
        geometry: feature.geometry,
    };
}
