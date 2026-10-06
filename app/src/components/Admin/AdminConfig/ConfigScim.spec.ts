import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const PUT = vi.fn();

vi.mock('../../../std.ts', () => ({
    server: {
        GET: (...args: unknown[]) => GET(...args),
        PUT: (...args: unknown[]) => PUT(...args)
    },
    stdurl: (path: string) => new URL(path, 'https://cloudtak.example.com')
}));

import ConfigScim from './ConfigScim.vue';

async function mountScim(config: Record<string, unknown>) {
    GET.mockResolvedValue({ data: config, error: undefined });
    PUT.mockResolvedValue({ data: {}, error: undefined });

    const wrapper = mount(ConfigScim);

    await wrapper.find('.slidedown__header').trigger('click');
    await flushPromises();

    return wrapper;
}

describe('Admin/AdminConfig/ConfigScim', () => {
    afterEach(() => {
        GET.mockReset();
        PUT.mockReset();
    });

    it('hides the Agency settings until Agency provisioning is enabled', async () => {
        const wrapper = await mountScim({
            'scim::enabled': true,
            'scim::token': 'token',
            'scim::agency::enabled': false,
            'scim::agency::prefix': 'Agency-'
        });

        expect(GET).toHaveBeenCalledWith('/api/config', {
            params: { query: { keys: 'scim::enabled,scim::token,scim::agency::enabled,scim::agency::prefix' } }
        });

        expect(wrapper.text()).toContain('Enable Agency Provisioning via SCIM Groups');
        expect(wrapper.text()).not.toContain('Agency Group Prefix');
    });

    it('shows the prefix with an example Group name and saves every key', async () => {
        const wrapper = await mountScim({
            'scim::enabled': true,
            'scim::token': 'token',
            'scim::agency::enabled': true,
            'scim::agency::prefix': 'Agency-'
        });

        expect(wrapper.text()).toContain('Agency Group Prefix');
        expect(wrapper.find('code').text()).toBe('Agency-12');

        await wrapper.find('[title="Edit"]').trigger('click');
        await wrapper.find('[title="Save"]').trigger('click');
        await flushPromises();

        expect(PUT).toHaveBeenCalledWith('/api/config', {
            body: {
                'scim::enabled': true,
                'scim::token': 'token',
                'scim::agency::enabled': true,
                'scim::agency::prefix': 'Agency-'
            }
        });
    });

    it('requires a prefix when Agency provisioning is enabled', async () => {
        const wrapper = await mountScim({
            'scim::enabled': true,
            'scim::token': 'token',
            'scim::agency::enabled': true,
            'scim::agency::prefix': ''
        });

        await wrapper.find('[title="Edit"]').trigger('click');
        await wrapper.find('[title="Save"]').trigger('click');
        await flushPromises();

        expect(PUT).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('An Agency Group Prefix is required when Agency provisioning is enabled');
    });
});
