import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    PATCH: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
    POST: vi.fn(),
}));

vi.mock('../std.ts', () => ({ server, downloadUrl: vi.fn() }));
vi.mock('../base/cot.ts', () => ({
    default: { style: async (feat: unknown) => feat },
    renderedIcon: () => undefined,
}));

import { db } from '../database.ts';
import Subscription from '../base/subscription.ts';
import type { Mission, MissionRole } from '../types.ts';

const GUID = 'mission-guid';

const mission = {
    guid: GUID,
    name: 'Mission',
    keywords: [],
    contents: [],
} as unknown as Mission;

const role = { type: 'MISSION_SUBSCRIBER', permissions: ['MISSION_READ', 'MISSION_WRITE'] } as unknown as MissionRole;
const owner = { type: 'MISSION_OWNER', permissions: ['MISSION_READ', 'MISSION_WRITE', 'MISSION_DELETE'] } as unknown as MissionRole;

function roleCalls(): number {
    return server.GET.mock.calls.filter(([path]) => path === '/api/marti/missions/{:guid}/role').length;
}

describe('Subscription', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        server.GET.mockImplementation(async (path: string) => {
            if (path === '/api/marti/missions/{:guid}/role') return { data: owner };
            return { data: { data: [] } };
        });

        await db.subscription.clear();
        await db.subscription.put({
            guid: GUID,
            name: mission.name,
            dirty: false,
            subscribed: true,
            meta: mission,
            role,
            token: '',
        });
    });

    it('does not listen unless asked', async () => {
        const sub = await Subscription.from(GUID);
        expect(sub?.live).toBe(false);
    });

    it('follows changes made through another instance while live, and stops after close', async () => {
        const live = await Subscription.from(GUID, { live: true });
        const other = await Subscription.from(GUID);
        if (!live || !other) throw new Error('missing subscription');

        expect(live.live).toBe(true);

        await other.update({ subscribed: false });
        await vi.waitFor(() => expect(live.subscribed).toBe(false));

        live.close();
        expect(live.live).toBe(false);

        await other.update({ subscribed: true });
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(live.subscribed).toBe(false);

        live.close();
    });

    it('still announces changes from an instance that is not listening', async () => {
        const live = await Subscription.from(GUID, { live: true });
        if (!live) throw new Error('missing subscription');

        const sub = new Subscription(mission, role, { subscribed: true });
        expect(sub.live).toBe(false);

        await sub.update({ subscribed: false });

        await vi.waitFor(() => expect(live.subscribed).toBe(false));
        live.close();
    });

    it('refetches the role when the subscription state changes', async () => {
        const sub = await Subscription.from(GUID);
        if (!sub) throw new Error('missing subscription');

        expect(sub.role.type).toBe('MISSION_SUBSCRIBER');

        await sub.update({ subscribed: false });

        expect(roleCalls()).toBe(1);
        expect(sub.role.type).toBe('MISSION_OWNER');
        expect((await db.subscription.get(GUID))?.role.type).toBe('MISSION_OWNER');
    });

    it('sends the mission token when refetching the role', async () => {
        const sub = await Subscription.from(GUID);
        if (!sub) throw new Error('missing subscription');

        await sub.update({ token: 'secret' });

        const call = server.GET.mock.calls.find(([path]) => path === '/api/marti/missions/{:guid}/role');
        expect(call?.[1].headers).toEqual({ MissionAuthorization: 'secret' });
    });

    it('does not refetch the role for metadata only updates', async () => {
        const sub = await Subscription.from(GUID);
        if (!sub) throw new Error('missing subscription');

        server.PATCH.mockResolvedValue({ data: { ...mission, description: 'next' } });

        await sub.update({ description: 'next' });

        expect(roleCalls()).toBe(0);
        expect(sub.role.type).toBe('MISSION_SUBSCRIBER');
    });

    it('keeps the cached role when the role request fails', async () => {
        server.GET.mockResolvedValue({ error: { message: 'offline' } });

        const sub = await Subscription.from(GUID);
        if (!sub) throw new Error('missing subscription');

        await sub.update({ subscribed: false });

        expect(sub.subscribed).toBe(false);
        expect(sub.role.type).toBe('MISSION_SUBSCRIBER');
    });

    it('refreshes the role as part of a refresh', async () => {
        const sub = await Subscription.from(GUID);
        if (!sub) throw new Error('missing subscription');

        for (const store of [sub.log, sub.feature, sub.layer, sub.change]) {
            vi.spyOn(store, 'refresh').mockResolvedValue(undefined);
        }

        await sub.refresh();

        expect(roleCalls()).toBe(1);
        expect(sub.role.type).toBe('MISSION_OWNER');
    });

    it('propagates a refreshed role to live instances', async () => {
        const live = await Subscription.from(GUID, { live: true });
        const other = await Subscription.from(GUID);
        if (!live || !other) throw new Error('missing subscription');

        await other.update({ subscribed: false });
        await vi.waitFor(() => expect(live.role.type).toBe('MISSION_OWNER'));

        live.close();
    });
});
