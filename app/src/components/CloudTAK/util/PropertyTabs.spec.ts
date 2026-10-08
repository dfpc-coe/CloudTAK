import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PropertyTabs from './PropertyTabs.vue';

describe('PropertyTabs', () => {
    const tabs = [
        { value: 'details', label: 'Details', count: 3 },
        { value: 'sharing', label: 'Sharing' },
    ];

    it('marks the selected tab and shows counts only where given', () => {
        const wrapper = mount(PropertyTabs, {
            props: { modelValue: 'sharing', tabs }
        });

        const links = wrapper.findAll('button.nav-link');

        expect(links).toHaveLength(2);
        expect(links[0].classes()).not.toContain('active');
        expect(links[1].classes()).toContain('active');
        expect(links[0].text()).toContain('3');
        expect(links[1].find('.badge').exists()).toBe(false);
    });

    it('emits the clicked tab', async () => {
        const wrapper = mount(PropertyTabs, {
            props: { modelValue: 'details', tabs }
        });

        await wrapper.findAll('button.nav-link')[1].trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([['sharing']]);
    });
});
