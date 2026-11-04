import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TimesFooter from './TimesFooter.vue';

describe('TimesFooter', () => {
    const created = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const updated = new Date(Date.now() - 30 * 1000).toISOString();

    it('lists relative times with their labels and suffix', () => {
        const wrapper = mount(TimesFooter, {
            props: {
                entries: [
                    { label: 'Created', time: created, suffix: 'by ingalls' },
                    { label: 'Updated', time: updated },
                ]
            }
        });

        expect(wrapper.text()).toContain('Created 2 minutes ago by ingalls');
        expect(wrapper.text()).toContain('Updated 30 seconds ago');
    });

    it('toggles to absolute times on click', async () => {
        const wrapper = mount(TimesFooter, {
            props: { entries: [{ label: 'Updated', time: updated }] }
        });

        await wrapper.trigger('click');

        expect(wrapper.text()).toBe(`Updated ${new Date(updated).toLocaleString()}`);
    });
});
