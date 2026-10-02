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

describe('Subscription', () => {
    beforeEach(async () => {
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
});
