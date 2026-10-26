import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.fn<() => 'web' | 'android' | 'ios'>(() => 'web');

vi.mock('../../../utils/capacitor.ts', () => ({
    isNativePlatform: () => platform() !== 'web',
    isAndroidPlatform: () => platform() === 'android',
    isIOSPlatform: () => platform() === 'ios'
}));

import LocationDisclosure from './LocationDisclosure.vue';

describe('LocationDisclosure', () => {
    beforeEach(() => {
        platform.mockReturnValue('web');
    });

    it('discloses background collection before the Android foreground prompt', () => {
        platform.mockReturnValue('android');
        const wrapper = mount(LocationDisclosure, { props: { stage: 'location' } });

        expect(wrapper.text()).toContain('when the app is closed or not in use');
        expect(wrapper.text()).toContain('Android will ask for location access');
        expect(wrapper.text()).not.toContain('persistent notification');
    });

    it('discloses background use directly before the Android background request', () => {
        platform.mockReturnValue('android');
        const wrapper = mount(LocationDisclosure, { props: { stage: 'background' } });

        expect(wrapper.text()).toContain('Background location');
        expect(wrapper.text()).toContain('even when the app is closed or not in use');
        expect(wrapper.text()).toContain('persistent notification');
        expect(wrapper.text()).toContain('"Allow all the time"');
    });

    it('describes the settings hand-off when the permission was denied', () => {
        platform.mockReturnValue('ios');
        const wrapper = mount(LocationDisclosure, { props: { stage: 'background', settings: true } });

        expect(wrapper.text()).toContain('open your device settings');
        expect(wrapper.text()).toContain('"Always"');
    });

    it('describes a browser prompt on web', () => {
        const wrapper = mount(LocationDisclosure, { props: { stage: 'location' } });

        expect(wrapper.text()).toContain('while it is open in your browser');
        expect(wrapper.text()).toContain('your browser will ask');
    });

    it('requires an explicit action and can be declined', async () => {
        const wrapper = mount(LocationDisclosure, { props: { stage: 'location' } });
        const buttons = wrapper.findAll('button');

        await buttons[0].trigger('click');
        await buttons[1].trigger('click');

        expect(wrapper.emitted('decline')).toHaveLength(1);
        expect(wrapper.emitted('accept')).toHaveLength(1);
    });

    it('disables both actions while a request is in flight', () => {
        const wrapper = mount(LocationDisclosure, { props: { stage: 'location', working: true } });

        expect(wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true);
        expect(wrapper.text()).toContain('Requesting...');
    });
});
