import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MenuDropdownItem from './MenuDropdownItem.vue';

describe('MenuDropdownItem', () => {
    it('renders a dropdown item and emits click', async () => {
        const wrapper = mount(MenuDropdownItem, {
            props: { label: 'Buffer' }
        });

        const button = wrapper.get('button.dropdown-item');
        expect(button.text()).toBe('Buffer');
        expect(button.classes()).not.toContain('text-danger');

        await button.trigger('click');

        expect(wrapper.emitted('click')).toHaveLength(1);
    });

    it('styles a destructive item', () => {
        const wrapper = mount(MenuDropdownItem, {
            props: { label: 'Delete', danger: true, disabled: true }
        });

        const button = wrapper.get('button');
        expect(button.classes()).toContain('text-danger');
        expect(button.attributes('disabled')).toBeDefined();
    });
});
