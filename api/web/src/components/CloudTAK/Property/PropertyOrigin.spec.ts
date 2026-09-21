import 'fake-indexeddb/auto';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../std.ts', () => ({ server: {} }));
vi.mock('../../../base/filter.ts', () => ({ default: { list: async () => [] } }));
vi.mock('../../../base/subscription.ts', () => ({ default: class {} }));
vi.mock('../../../base/cot.ts', () => ({
    default: { style: async (feat: unknown) => feat },
    renderedIcon: () => undefined,
}));

import { db } from '../../../database.ts';
import SubscriptionFeature from '../../../base/subscription-feature.ts';
import type Subscription from '../../../base/subscription.ts';
import PropertyOrigin from './PropertyOrigin.vue';

const GUID = 'mission-guid';

function subscription(permissions: string[]): Subscription {
    const sub = {
        guid: GUID,
        name: 'Mission',
        meta: { guid: GUID, name: 'Mission' },
        role: { permissions },
    } as unknown as Subscription;

    sub.feature = new SubscriptionFeature(sub, {});

    return sub;
}

async function seed(id: string, synced: boolean, error?: string): Promise<void> {
    await db.subscription_feature.put({
        id,
        mission: GUID,
        path: '/',
        properties: { id, type: 'u-d-p', time: '2026-01-01T00:00:00.000Z' },
        geometry: { type: 'Point', coordinates: [0, 0] },
        synced,
        deleted: false,
        attempts: 0,
        error,
    } as never);
}

async function settle(): Promise<void> {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await flushPromises();
}

describe('PropertyOrigin', () => {
    beforeEach(async () => {
        await db.subscription_feature.clear();
    });

    it('shows Not Synced only while the feature has an unconfirmed local change', async () => {
        await seed('feat', false, 'Offline');

        const wrapper = mount(PropertyOrigin, {
            props: { subscription: subscription(['MISSION_WRITE']), uid: 'feat' },
        });

        await settle();

        expect(wrapper.text()).toContain('Not Synced');
        expect(wrapper.text()).not.toContain('Read Only');
        expect(wrapper.html()).toContain('Offline');

        await db.subscription_feature.update('feat', { synced: true, error: undefined });
        await settle();

        expect(wrapper.text()).not.toContain('Not Synced');
    });

    it('shows Read Only alongside a synced feature', async () => {
        await seed('feat', true);

        const wrapper = mount(PropertyOrigin, {
            props: { subscription: subscription(['MISSION_READ']), uid: 'feat' },
        });

        await settle();

        expect(wrapper.text()).toContain('Read Only');
        expect(wrapper.text()).not.toContain('Not Synced');
    });

    it('pushes the feature and shows a loading status when Not Synced is clicked', async () => {
        await seed('feat', false, 'Offline');

        const sub = subscription(['MISSION_WRITE']);

        let resolve: (ok: boolean) => void = () => {};
        const push = vi.spyOn(sub.feature, 'push').mockImplementation(() => {
            return new Promise<boolean>((res) => { resolve = res; });
        });

        const wrapper = mount(PropertyOrigin, {
            props: { subscription: sub, uid: 'feat' },
        });

        await settle();

        await wrapper.find('.tabler-badge').trigger('click');

        expect(push).toHaveBeenCalledTimes(1);
        expect(wrapper.text()).toContain('Syncing');
        expect(wrapper.text()).not.toContain('Not Synced');

        // Clicks while a sync is in flight do not start another
        await wrapper.find('.tabler-badge').trigger('click');
        expect(push).toHaveBeenCalledTimes(1);

        resolve(false);
        await settle();

        expect(wrapper.text()).toContain('Not Synced');
        expect(wrapper.text()).not.toContain('Syncing');
    });
});
