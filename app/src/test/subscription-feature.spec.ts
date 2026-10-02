import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
}));

vi.mock('../std.ts', () => ({ server }));
vi.mock('../base/filter.ts', () => ({ default: { list: async () => [] } }));
vi.mock('../base/subscription.ts', () => ({ default: class {} }));
vi.mock('../base/cot.ts', () => ({
    default: { style: async (feat: unknown) => feat },
    renderedIcon: () => undefined,
}));

import { db } from '../database.ts';
import type { DBSubscriptionFeature } from '../database.ts';
import SubscriptionFeature from '../base/subscription-feature.ts';
import type Subscription from '../base/subscription.ts';
import type Atlas from '../workers/atlas.ts';
import type COT from '../base/cot.ts';
import type { Feature } from '../types.ts';

const GUID = 'mission-guid';
const OLD = '2026-01-01T00:00:00.000Z';
const NEWER = '2026-01-02T00:00:00.000Z';

const sendCOT = vi.fn();
const atlas = { conn: { sendCOT } } as unknown as Atlas;

function feat(id: string, time: string, remarks = 'server', type = 'u-d-p'): Feature {
    return {
        id,
        type: 'Feature',
        path: '/',
        properties: { id, type, time, remarks },
        geometry: { type: 'Point', coordinates: [0, 0] },
    } as unknown as Feature;
}

function cot(id: string, time: string, remarks: string, type = 'u-d-p'): COT {
    const feature = feat(id, time, remarks, type);
    return { ...feature, as_feature: () => structuredClone(feature) } as unknown as COT;
}

async function seed(id: string, row: Partial<DBSubscriptionFeature> & { time: string, remarks?: string }): Promise<void> {
    const feature = feat(id, row.time, row.remarks || 'local');

    await db.subscription_feature.put({
        id,
        mission: GUID,
        path: feature.path,
        properties: feature.properties,
        geometry: feature.geometry,
        synced: true,
        deleted: false,
        attempts: 0,
        ...Object.fromEntries(Object.entries(row).filter(([key]) => !['time', 'remarks'].includes(key))),
    });
}

function deferred<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

function putFeatures(call: number): Array<Feature> {
    return server.PUT.mock.calls[call][1].body.features;
}

describe('SubscriptionFeature', () => {
    let feature: SubscriptionFeature;

    beforeEach(async () => {
        await db.subscription_feature.clear();
        await db.subscription_chat.clear();

        sendCOT.mockReset();
        server.GET.mockReset();
        server.PUT.mockReset().mockResolvedValue({ data: { status: 200, message: 'CoTs Submitted', uids: [] } });
        server.DELETE.mockReset().mockResolvedValue({ data: {}, response: { status: 200 } });

        feature = new SubscriptionFeature({
            guid: GUID,
            name: 'Mission',
            update: vi.fn(),
        } as unknown as Subscription, {});
    });

    describe('refresh', () => {
        it('replaces synced rows and preserves unsynced rows and tombstones', async () => {
            await seed('synced-kept', { time: OLD });
            await seed('synced-gone', { time: OLD });
            await seed('unsynced-offline', { time: OLD, synced: false });
            await seed('tombstone', { time: OLD, synced: false, deleted: true });

            server.GET.mockResolvedValue({
                data: { type: 'FeatureCollection', features: [
                    feat('synced-kept', NEWER),
                    feat('tombstone', NEWER),
                    feat('remote-new', NEWER),
                ] }
            });

            await feature.refresh();

            const rows = new Map((await db.subscription_feature.toArray()).map((r) => [r.id, r]));

            expect([...rows.keys()].sort()).toEqual(['remote-new', 'synced-kept', 'tombstone', 'unsynced-offline']);
            expect(rows.get('synced-kept')?.properties.remarks).toBe('server');
            expect(rows.get('unsynced-offline')).toMatchObject({ synced: false, deleted: false });
            expect(rows.get('tombstone')).toMatchObject({ deleted: true });
            expect(rows.get('tombstone')?.properties.remarks).toBe('local');

            expect((await feature.list()).map((f) => f.id).sort()).toEqual(['remote-new', 'synced-kept', 'unsynced-offline']);
        });

        it('keeps an unsynced row over an older or equal server copy, not a newer one', async () => {
            await seed('local-newer', { time: NEWER, synced: false });
            await seed('local-equal', { time: OLD, synced: false });
            await seed('local-older', { time: OLD, synced: false });

            server.GET.mockResolvedValue({
                data: { type: 'FeatureCollection', features: [
                    feat('local-newer', OLD),
                    feat('local-equal', OLD),
                    feat('local-older', NEWER),
                ] }
            });

            await feature.refresh();

            expect(await db.subscription_feature.get('local-newer')).toMatchObject({ synced: false, properties: { remarks: 'local' } });
            expect(await db.subscription_feature.get('local-equal')).toMatchObject({ synced: false, properties: { remarks: 'local' } });
            expect(await db.subscription_feature.get('local-older')).toMatchObject({ synced: true, properties: { remarks: 'server' } });
        });

        it('drops a tombstone the server no longer has', async () => {
            await seed('tombstone', { time: OLD, synced: false, deleted: true });

            server.GET.mockResolvedValue({ data: { type: 'FeatureCollection', features: [] } });

            await feature.refresh();

            expect(await db.subscription_feature.count()).toBe(0);
        });

        it('does not touch other missions', async () => {
            await seed('other', { time: OLD, mission: 'other-mission' });

            server.GET.mockResolvedValue({ data: { type: 'FeatureCollection', features: [] } });

            await feature.refresh();

            expect(await db.subscription_feature.get('other')).toBeDefined();
        });
    });

    describe('pendingFrom', () => {
        it('returns unsynced rows and tombstones but not synced rows or other missions', async () => {
            await seed('synced', { time: OLD });
            await seed('unsynced', { time: OLD, synced: false, error: 'Offline' });
            await seed('tombstone', { time: OLD, synced: false, deleted: true });
            await seed('other', { time: OLD, synced: false, mission: 'other-mission' });

            expect(await feature.pendingFrom('synced')).toBeUndefined();
            expect(await feature.pendingFrom('other')).toBeUndefined();
            expect(await feature.pendingFrom('missing')).toBeUndefined();
            expect((await feature.pendingFrom('unsynced'))?.error).toBe('Offline');
            expect((await feature.pendingFrom('tombstone'))?.deleted).toBe(true);
        });
    });

    describe('update', () => {
        it('writes unsynced, submits over HTTP and marks synced once confirmed', async () => {
            const put = deferred<unknown>();
            server.PUT.mockReturnValue(put.promise);

            await feature.update(atlas, cot('a', OLD, 'edited'));

            const pending = await db.subscription_feature.get('a');
            expect(pending).toMatchObject({ synced: false, deleted: false, attempts: 0 });
            expect(new Date(String(pending?.properties.time)).getTime()).toBeGreaterThan(new Date(NEWER).getTime());

            put.resolve({ data: { status: 200, message: 'CoTs Submitted', uids: ['a'] } });
            expect(await feature.push()).toBe(true);

            expect(await db.subscription_feature.get('a')).toMatchObject({ synced: true, attempts: 0 });
            expect(server.PUT).toHaveBeenCalledTimes(1);
            expect(server.PUT.mock.calls[0][1].params.path[':guid']).toBe(GUID);
            expect(putFeatures(0).map((f) => f.id)).toEqual(['a']);
            expect(sendCOT).not.toHaveBeenCalled();
        });

        it('resolves when the network fails and records the failure on the row', async () => {
            server.PUT.mockRejectedValue(new TypeError('Failed to fetch'));

            await feature.update(atlas, cot('a', OLD, 'offline edit'));
            expect(await feature.push()).toBe(false);

            const row = await db.subscription_feature.get('a');
            expect(row).toMatchObject({ synced: false, error: 'Failed to fetch' });
            expect(row?.attempts).toBeGreaterThanOrEqual(1);
            expect((await feature.list()).map((f) => f.id)).toEqual(['a']);
        });

        it('records an API error and clears it on a later successful push', async () => {
            server.PUT.mockResolvedValueOnce({ error: { status: 502, message: 'Unconfirmed UIDs' }, response: { status: 502 } });

            await feature.update(atlas, cot('a', OLD, 'edit'));
            await feature.push();

            server.PUT.mockClear();
            expect(await feature.push()).toBe(true);

            const row = await db.subscription_feature.get('a');
            expect(row).toMatchObject({ synced: true, attempts: 0 });
            expect(row?.error).toBeUndefined();
            expect(server.PUT).toHaveBeenCalledTimes(1);
        });

        it('isolates a rejected feature from the rest of its batch', async () => {
            for (let i = 0; i < 6; i++) {
                await seed(`f-${i}`, { time: OLD, synced: false });
            }

            const rejection = 'Validation Error PUT /marti/missions/:guid/cot';

            server.PUT.mockImplementation(async (_path: string, opts: { body: { features: Array<Feature> } }) => {
                if (opts.body.features.some((f) => f.id === 'f-3')) {
                    return { error: { status: 400, message: rejection }, response: { status: 400 } };
                }

                return { data: { status: 200, message: 'CoTs Submitted', uids: opts.body.features.map((f) => f.id) } };
            });

            expect(await feature.push()).toBe(false);

            const rows = await db.subscription_feature.toArray();
            expect(rows.filter((r) => r.synced).map((r) => r.id).sort()).toEqual(['f-0', 'f-1', 'f-2', 'f-4', 'f-5']);
            expect(await db.subscription_feature.get('f-3')).toMatchObject({ synced: false, error: rejection });
            expect(server.PUT.mock.calls.length).toBeLessThan(12);
        });

        it('fails only the uids TAK Server did not confirm without resubmitting the rest', async () => {
            for (let i = 0; i < 5; i++) {
                await seed(`f-${i}`, { time: OLD, synced: false });
            }

            const message = 'TAK Server did not confirm CoT: f-1, f-4';
            server.PUT.mockResolvedValue({ error: { status: 502, message }, response: { status: 502 } });

            expect(await feature.push()).toBe(false);

            expect(server.PUT).toHaveBeenCalledTimes(1);
            expect((await feature.pending()).map((r) => r.id).sort()).toEqual(['f-1', 'f-4']);
            expect(await db.subscription_feature.get('f-1')).toMatchObject({ synced: false, error: message, attempts: 1 });
            expect(await db.subscription_feature.get('f-0')).toMatchObject({ synced: true, attempts: 0 });
        });

        it.each([
            ['TAK Server is unreachable', 400, 'Failed to fetch: connect ECONNREFUSED'],
            ['the API is down', 500, 'Internal Server Error'],
            ['the mission is gone', 404, 'Mission not found'],
        ])('fails the whole batch in one request when %s', async (_label, status, message) => {
            for (let i = 0; i < 4; i++) {
                await seed(`f-${i}`, { time: OLD, synced: false });
            }

            server.PUT.mockResolvedValue({ error: { status, message }, response: { status } });

            expect(await feature.push()).toBe(false);

            expect(server.PUT).toHaveBeenCalledTimes(1);
            expect((await feature.pending()).every((r) => r.error === message)).toBe(true);
        });

        it('resubmits a row edited while its request was in flight', async () => {
            const first = deferred<unknown>();
            server.PUT.mockReturnValueOnce(first.promise);

            await feature.update(atlas, cot('a', OLD, 'first'));
            await feature.update(atlas, cot('a', OLD, 'second'));

            expect(server.PUT).toHaveBeenCalledTimes(1);

            first.resolve({ data: { status: 200, message: 'CoTs Submitted', uids: ['a'] } });
            expect(await feature.push()).toBe(true);

            expect(server.PUT).toHaveBeenCalledTimes(2);
            expect(putFeatures(0)[0].properties.remarks).toBe('first');
            expect(putFeatures(1)[0].properties.remarks).toBe('second');
            expect(await db.subscription_feature.get('a')).toMatchObject({ synced: true, properties: { remarks: 'second' } });
        });

        it('submits in batches of 100', async () => {
            for (let i = 0; i < 250; i++) {
                await seed(`f-${i}`, { time: OLD, synced: false });
            }

            expect(await feature.push()).toBe(true);

            expect(server.PUT.mock.calls.map((_, i) => putFeatures(i).length)).toEqual([100, 100, 50]);
            expect(await feature.pending()).toEqual([]);
        });

        it('keeps chat on the websocket', async () => {
            const chat = cot('chat-1', OLD, 'hello', 'b-t-f');

            await feature.update(atlas, chat);
            await feature.push();

            expect(sendCOT).toHaveBeenCalledTimes(1);
            expect(sendCOT.mock.calls[0][0].properties.dest).toEqual([{ mission: 'Mission' }]);
            expect(server.PUT).not.toHaveBeenCalled();
            expect(await db.subscription_feature.count()).toBe(0);
        });
    });

    describe('echo ordering', () => {
        it('ignores an older echo of an unsynced row', async () => {
            await seed('a', { time: NEWER, synced: false, remarks: 'local' });

            await feature.update(atlas, cot('a', OLD, 'echo'), { skipNetwork: true });

            expect(await db.subscription_feature.get('a')).toMatchObject({ synced: false, properties: { remarks: 'local' } });
            expect(server.PUT).not.toHaveBeenCalled();
        });

        it('accepts a newer server copy over an unsynced row', async () => {
            await seed('a', { time: OLD, synced: false, remarks: 'local' });

            await feature.update(atlas, cot('a', NEWER, 'remote edit'), { skipNetwork: true });

            expect(await db.subscription_feature.get('a')).toMatchObject({ synced: true, properties: { remarks: 'remote edit', time: NEWER } });
        });

        it('always accepts the server copy over a synced row', async () => {
            await seed('a', { time: NEWER, remarks: 'local' });

            await feature.update(atlas, cot('a', OLD, 'remote'), { skipNetwork: true });

            expect(await db.subscription_feature.get('a')).toMatchObject({ synced: true, properties: { remarks: 'remote' } });
        });

        it('does not resurrect a tombstone', async () => {
            await seed('a', { time: OLD, synced: false, deleted: true });

            await feature.update(atlas, cot('a', NEWER, 'echo'), { skipNetwork: true });

            expect(await db.subscription_feature.get('a')).toMatchObject({ deleted: true });
            expect(await feature.from('a')).toBeUndefined();
        });
    });

    describe('delete', () => {
        it('tombstones, hides the feature and removes the row once the server confirms', async () => {
            await seed('a', { time: OLD });

            const del = deferred<unknown>();
            server.DELETE.mockReturnValue(del.promise);

            await feature.delete(atlas, 'a');

            expect(await db.subscription_feature.get('a')).toMatchObject({ deleted: true, synced: false });
            expect(await feature.list()).toEqual([]);
            expect(await feature.from('a')).toBeUndefined();

            del.resolve({ data: {}, response: { status: 200 } });
            expect(await feature.push()).toBe(true);

            expect(await db.subscription_feature.get('a')).toBeUndefined();
            expect(server.DELETE.mock.calls[0][1].params.path).toEqual({ ':guid': GUID, ':uid': 'a' });
        });

        it('replays a tombstone that failed offline', async () => {
            await seed('a', { time: OLD });
            server.DELETE.mockRejectedValueOnce(new TypeError('Failed to fetch'));

            await feature.delete(atlas, 'a');
            expect(await feature.push()).toBe(false);

            expect(await db.subscription_feature.get('a')).toMatchObject({ deleted: true, attempts: 1, error: 'Failed to fetch' });

            server.DELETE.mockClear();
            expect(await feature.push()).toBe(true);

            expect(server.DELETE).toHaveBeenCalledTimes(1);
            expect(await db.subscription_feature.get('a')).toBeUndefined();
        });

        it('treats a 404 as deleted', async () => {
            await seed('a', { time: OLD, synced: false, deleted: true });
            server.DELETE.mockResolvedValue({ error: { status: 404, message: 'Not Found' }, response: { status: 404 } });

            expect(await feature.push()).toBe(true);
            expect(await db.subscription_feature.get('a')).toBeUndefined();
        });

        it('keeps a feature recreated while its delete was in flight', async () => {
            await seed('a', { time: OLD });

            const del = deferred<unknown>();
            server.DELETE.mockReturnValue(del.promise);

            await feature.delete(atlas, 'a');
            await feature.update(atlas, cot('a', OLD, 'recreated'));

            del.resolve({ data: {}, response: { status: 200 } });
            expect(await feature.push()).toBe(true);

            expect(await db.subscription_feature.get('a')).toMatchObject({ deleted: false, synced: true, properties: { remarks: 'recreated' } });
            expect(putFeatures(0)[0].properties.remarks).toBe('recreated');
        });

        it('removes synced rows and tombstones for a server initiated delete', async () => {
            await seed('synced', { time: OLD });
            await seed('tombstone', { time: OLD, synced: false, deleted: true });

            await feature.delete(atlas, 'synced', { skipNetwork: true });
            await feature.delete(atlas, 'tombstone', { skipNetwork: true });

            expect(await db.subscription_feature.count()).toBe(0);
            expect(server.DELETE).not.toHaveBeenCalled();
        });

        it('keeps an unsynced edit through a server initiated delete', async () => {
            await seed('a', { time: OLD, synced: false });

            await feature.delete(atlas, 'a', { skipNetwork: true });

            expect(await db.subscription_feature.get('a')).toMatchObject({ synced: false, deleted: false });
            expect(server.DELETE).not.toHaveBeenCalled();
        });
    });
});
