import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PropertyCoreEntityStatus from './PropertyCoreEntityStatus.vue';

const HOUR = 60 * 60 * 1000;

describe('PropertyCoreEntityStatus', () => {
    it('summarises an open ended active Event', () => {
        const wrapper = mount(PropertyCoreEntityStatus, {
            props: {
                active: true,
                priority: 'high',
                started: new Date(Date.now() - 2 * HOUR).toISOString(),
                ended: null,
                edit: true
            }
        });

        expect(wrapper.text()).toContain('Active');
        expect(wrapper.text()).toContain('High');
        expect(wrapper.text()).toContain('Started 2 hours ago');
        expect(wrapper.text()).toContain('Open ended');
        expect(wrapper.get('button').text()).toBe('End');
    });

    it('offers to reactivate an ended Event and hides the none priority', async () => {
        const wrapper = mount(PropertyCoreEntityStatus, {
            props: {
                active: false,
                priority: 'none',
                started: new Date(Date.now() - 3 * HOUR).toISOString(),
                ended: new Date(Date.now() - HOUR).toISOString(),
                edit: true
            }
        });

        expect(wrapper.text()).toContain('Ended 1 hour ago');
        expect(wrapper.find('.badge').exists()).toBe(false);

        await wrapper.get('button').trigger('click');

        expect(wrapper.emitted('update:active')).toEqual([[true]]);
    });

    it('has no action for readers', () => {
        const wrapper = mount(PropertyCoreEntityStatus, {
            props: {
                active: true,
                priority: 'low',
                started: new Date().toISOString(),
                ended: null
            }
        });

        expect(wrapper.find('button').exists()).toBe(false);
    });
});
