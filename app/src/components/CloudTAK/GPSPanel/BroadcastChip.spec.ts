import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { LocationState } from '../../../utils/events.ts';

const map = reactive({ location: LocationState.Live as LocationState });
vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => map
}));

const sharing = reactive({
    paused: false,
    standby: false,
    standbyBy: null as string | null,
    broadcastKnown: true,
    busy: false,
    resume: vi.fn(async () => {}),
    takeOver: vi.fn(async () => {})
});
vi.mock('../../../stores/sharing.ts', () => ({
    useSharingStore: () => sharing
}));

import BroadcastChip from './BroadcastChip.vue';

describe('BroadcastChip', () => {
    beforeEach(() => {
        map.location = LocationState.Live;
        sharing.paused = false;
        sharing.standby = false;
        sharing.standbyBy = null;
        sharing.broadcastKnown = true;
        sharing.busy = false;
        sharing.resume.mockClear();
        sharing.takeOver.mockClear();
    });

    it('is hidden while this session is the broadcaster', () => {
        expect(mount(BroadcastChip).find('[data-test^="broadcast-chip"]').exists()).toBe(false);
    });

    it('standby: names the broadcaster and takes over on tap', async () => {
        sharing.standby = true;
        sharing.standbyBy = 'Pixel 8 (app)';
        const wrapper = mount(BroadcastChip);
        expect(wrapper.find('[data-test="broadcast-chip-text"]').text()).toBe('Shared from Pixel 8 (app)');
        await wrapper.find('[data-test="broadcast-chip-action"]').trigger('click');
        expect(sharing.takeOver).toHaveBeenCalledTimes(1);
        expect(sharing.resume).not.toHaveBeenCalled();
    });

    it('standby: still reads sensibly when the broadcaster has no label', () => {
        sharing.standby = true;
        const wrapper = mount(BroadcastChip);
        expect(wrapper.find('[data-test="broadcast-chip-text"]').text()).toBe('Shared from another device');
    });

    it('standby: Take over needs a position to broadcast', async () => {
        sharing.standby = true;
        map.location = LocationState.Disabled;
        const wrapper = mount(BroadcastChip);
        const button = wrapper.find('[data-test="broadcast-chip-action"]');
        expect(button.attributes('disabled')).toBeDefined();
        expect(button.attributes('title')).toBe('Set your location first');
        await button.trigger('click');
        expect(sharing.takeOver).not.toHaveBeenCalled();
    });

    it('standby: a manual location is enough to take over', () => {
        sharing.standby = true;
        map.location = LocationState.Preset;
        const wrapper = mount(BroadcastChip);
        expect(wrapper.find('[data-test="broadcast-chip-action"]').attributes('disabled')).toBeUndefined();
    });

    it('is not shown before the server has reported a state', () => {
        sharing.standby = true;
        sharing.broadcastKnown = false;
        expect(mount(BroadcastChip).find('[data-test^="broadcast-chip"]').exists()).toBe(false);
    });

    it('paused wins over standby and resumes on tap, with no position needed', async () => {
        sharing.paused = true;
        sharing.standby = true;
        map.location = LocationState.Disabled;
        const wrapper = mount(BroadcastChip);
        expect(wrapper.find('[data-test="broadcast-chip-paused"]').exists()).toBe(true);
        expect(wrapper.find('[data-test="broadcast-chip-text"]').text()).toBe('Paused \u00b7 not connected');
        await wrapper.find('[data-test="broadcast-chip-action"]').trigger('click');
        expect(sharing.resume).toHaveBeenCalledTimes(1);
    });

    it('is disabled while a pause or resume is in progress', () => {
        sharing.paused = true;
        sharing.busy = true;
        const wrapper = mount(BroadcastChip);
        expect(wrapper.find('[data-test="broadcast-chip-action"]').attributes('disabled')).toBeDefined();
    });
});
