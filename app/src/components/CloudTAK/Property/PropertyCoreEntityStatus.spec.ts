import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PropertyCoreEntityStatus from './PropertyCoreEntityStatus.vue';

describe('PropertyCoreEntityStatus', () => {
    it('shows an active Event with its priority', () => {
        const wrapper = mount(PropertyCoreEntityStatus, {
            props: {
                active: true,
                priority: 'high',
                edit: true
            }
        });

        expect(wrapper.find('[title="Active"]').exists()).toBe(true);
        expect(wrapper.text()).toContain('High');
        expect(wrapper.get('button').text()).toBe('End');
    });

    it('offers to reactivate an ended Event and hides the none priority', async () => {
        const wrapper = mount(PropertyCoreEntityStatus, {
            props: {
                active: false,
                priority: 'none',
                edit: true
            }
        });

        expect(wrapper.find('[title="Ended"]').exists()).toBe(true);
        expect(wrapper.find('.badge').exists()).toBe(false);

        await wrapper.get('button').trigger('click');

        expect(wrapper.emitted('update:active')).toEqual([[true]]);
    });

    it('has no action for readers', () => {
        const wrapper = mount(PropertyCoreEntityStatus, {
            props: {
                active: true,
                priority: 'low'
            }
        });

        expect(wrapper.find('button').exists()).toBe(false);
    });
});
