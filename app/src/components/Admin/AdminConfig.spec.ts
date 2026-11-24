import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const push = vi.fn();
const route = reactive<{ params: { section?: string } }>({ params: {} });

vi.mock('../../std.ts', () => ({
    server: { GET: (...args: unknown[]) => GET(...args) },
    stdurl: (url: string) => new URL(url, 'http://localhost')
}));

vi.mock('vue-router', () => ({
    useRoute: () => route,
    useRouter: () => ({ push })
}));

import AdminConfig from './AdminConfig.vue';
import { sections } from './AdminConfig/sections.ts';

function mountConfig(section: string): VueWrapper {
    GET.mockResolvedValue({ data: undefined, error: { message: 'Not Loaded' } });
    route.params = { section };

    return mount(AdminConfig, { attachTo: document.body });
}

describe('Admin/AdminConfig', () => {
    afterEach(() => {
        GET.mockReset();
        push.mockReset();
        document.body.innerHTML = '';
    });

    it('renders every section on its own route', async () => {
        for (const section of sections) {
            const wrapper = mountConfig(section.slug);

            expect(wrapper.find('.card-title').text(), section.slug).toBe(section.label);
            expect(wrapper.text(), section.slug).not.toContain('Unknown Setting');

            wrapper.unmount();
        }
    });

    it('loads the section without a collapsible wrapper', async () => {
        const wrapper = mountConfig('retention');

        expect(wrapper.find('.slidedown').exists()).toBe(false);
        await nextTick();
        expect(wrapper.find('.card-header [title="Edit"]').exists()).toBe(true);
        expect(GET).toHaveBeenCalled();
    });

    it('renders Plugins as a section', async () => {
        const wrapper = mountConfig('plugins');

        expect(wrapper.find('.slidedown').exists()).toBe(false);
        expect(GET).toHaveBeenCalledWith('/api/plugin', expect.anything());
    });

    it('returns to the overview', async () => {
        const wrapper = mountConfig('scim');

        await wrapper.find('[data-config="back"]').trigger('click');
        expect(push).toHaveBeenCalledWith('/admin');
    });

    it('shows an empty state for an unknown section', async () => {
        const wrapper = mountConfig('nope');

        expect(wrapper.find('.card-title').text()).toBe('Settings');
        expect(wrapper.text()).toContain('Unknown Setting');
    });
});
