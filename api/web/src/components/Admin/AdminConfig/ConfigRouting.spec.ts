import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const PUT = vi.fn();

vi.mock('../../../std.ts', () => ({
    server: {
        GET: (...args: unknown[]) => GET(...args),
        PUT: (...args: unknown[]) => PUT(...args)
    }
}));

import ConfigRouting from './ConfigRouting.vue';

const agol = { id: 'agol', name: 'ArcGIS Online' };

async function mountRouting(search: unknown, config: Record<string, unknown> = {}) {
    GET.mockImplementation(async (path: string) => {
        if (path === '/api/search') return search;
        return { data: config, error: undefined };
    });

    PUT.mockResolvedValue({ data: {}, error: undefined });

    const wrapper = mount(ConfigRouting);

    await wrapper.find('.slidedown__header').trigger('click');
    await flushPromises();

    return wrapper;
}

describe('Admin/AdminConfig/ConfigRouting', () => {
    afterEach(() => {
        GET.mockReset();
        PUT.mockReset();
    });

    it('lists an active provider with its travel modes', async () => {
        const wrapper = await mountRouting({
            data: {
                forward: { enabled: true, providers: [agol] },
                reverse: { enabled: true, providers: [agol] },
                route: {
                    enabled: true,
                    providers: [{ ...agol, modes: [{ id: '1', name: 'Driving Time' }, { id: '2', name: 'Walking Time' }] }]
                }
            },
            error: undefined
        });

        expect(wrapper.find('label').text()).toBe('Routing Providers');

        const providers = wrapper.findAll('.slidedown .slidedown');
        expect(providers).toHaveLength(1);

        expect(providers[0].find('label').text()).toBe('ArcGIS Online');
        expect(providers[0].findAll('.badge').map(badge => badge.text())).toEqual([
            '2 Travel Modes', 'Default', 'Active'
        ]);
    });

    it('is inactive when only search uses the provider', async () => {
        const wrapper = await mountRouting({
            data: {
                forward: { enabled: true, providers: [agol] },
                reverse: { enabled: true, providers: [agol] },
                route: { enabled: false, providers: [] }
            },
            error: undefined
        });

        const providers = wrapper.findAll('.slidedown .slidedown');

        expect(providers[0].findAll('.badge').map(badge => badge.text())).toEqual(['Inactive']);
    });

    it('still lists providers when the status cannot be loaded', async () => {
        const wrapper = await mountRouting({ data: undefined, error: { message: 'Routing unavailable' } });

        expect(wrapper.findAll('.slidedown .slidedown')).toHaveLength(1);
        expect(wrapper.findAll('.badge')).toHaveLength(0);
        expect(wrapper.text()).toContain('Routing unavailable');
    });

    it('loads and saves credentials under the routing keys', async () => {
        const wrapper = await mountRouting({
            data: {
                forward: { enabled: false, providers: [] },
                reverse: { enabled: false, providers: [] },
                route: { enabled: false, providers: [] }
            },
            error: undefined
        }, {
            'routing::agol::enabled': true,
            'routing::agol::auth_method': 'legacy',
            'routing::agol::token': 'routing-token'
        });

        const provider = wrapper.find('.slidedown .slidedown');

        await provider.find('.slidedown__header').trigger('click');
        await flushPromises();

        const keys = GET.mock.calls
            .filter(call => call[0] === '/api/config')
            .map(call => call[1].params.query.keys);

        expect(keys).toEqual([
            'routing::agol::enabled,routing::agol::auth_method,routing::agol::token,routing::agol::client_id,routing::agol::client_secret'
        ]);

        await provider.find('[title="Edit"]').trigger('click');
        await provider.find('[title="Save"]').trigger('click');
        await flushPromises();

        expect(PUT).toHaveBeenCalledWith('/api/config', {
            body: {
                'routing::agol::enabled': true,
                'routing::agol::auth_method': 'legacy',
                'routing::agol::token': 'routing-token',
                'routing::agol::client_id': '',
                'routing::agol::client_secret': ''
            }
        });

        const body = PUT.mock.calls[0][1].body;
        expect(Object.keys(body).every(key => key.startsWith('routing::agol::'))).toBe(true);
    });
});
