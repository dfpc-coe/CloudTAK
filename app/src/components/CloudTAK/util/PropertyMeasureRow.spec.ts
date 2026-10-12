import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PropertyMeasureRow from './PropertyMeasureRow.vue';

const units = [
    { value: 'feet', label: 'ft', title: 'Feet' },
    { value: 'meter', label: 'm', title: 'Meters' },
];

describe('PropertyMeasureRow', () => {
    it('renders the label, value and unit tabs beneath the field', () => {
        const wrapper = mount(PropertyMeasureRow, {
            props: { label: 'Elevation', modelValue: 1609, unit: 'meter', units }
        });

        expect(wrapper.get('label').text()).toBe('Elevation');
        expect(wrapper.text()).toContain('1609');

        const tabs = wrapper.findAll('[role="menuitem"]');
        expect(tabs.map((tab) => tab.text())).toEqual(['ft', 'm']);
        expect(tabs[0].classes()).not.toContain('text-blue');
        expect(tabs[1].classes()).toContain('text-blue');
        expect(tabs[1].attributes('title')).toBe('Meters');
    });

    it('emits the picked unit', async () => {
        const wrapper = mount(PropertyMeasureRow, {
            props: { label: 'Elevation', modelValue: 1609, unit: 'meter', units }
        });

        await wrapper.findAll('[role="menuitem"]')[0].trigger('click');

        expect(wrapper.emitted('update:unit')).toEqual([['feet']]);
    });
});
