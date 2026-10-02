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

import ConfigSearch from './ConfigSearch.vue';

const agol = { id: 'agol', name: 'ArcGIS Online' };
const osm = { id: 'osm', name: 'OpenStreetMap' };

async function mountSearch(search: unknown, config: Record<string, unknown> = {}) {
    GET.mockImplementation(async (path: string) => {
        if (path === '/api/search') return search;
        return { data: config, error: undefined };
    });

    PUT.mockResolvedValue({ data: {}, error: undefined });

    const wrapper = mount(ConfigSearch);

    await wrapper.find('.slidedown__header').trigger('click');
    await flushPromises();

    return wrapper;
}

describe('Admin/AdminConfig/ConfigSearch', () => {
    afterEach(() => {
        GET.mockReset();
        PUT.mockReset();
    });

    it('lists every provider with its status and capabilities', async () => {
        const wrapper = await mountSearch({
            data: {
                forward: { enabled: true, providers: [agol, osm] },
                reverse: { enabled: true, providers: [agol, osm] },
                route: { enabled: true, providers: [{ ...agol, modes: [] }] }
            },
            error: undefined
        });

        const providers = wrapper.findAll('.slidedown .slidedown');
        expect(providers).toHaveLength(2);

        expect(providers[0].find('label').text()).toBe('ArcGIS Online');
        expect(providers[0].findAll('.badge').map(badge => badge.text())).toEqual([
            'Forward', 'Reverse', 'Default', 'Active'
        ]);

        expect(providers[1].find('label').text()).toBe('OpenStreetMap');
        expect(providers[1].findAll('.badge').map(badge => badge.text())).toEqual([
            'Forward', 'Reverse', 'Active'
        ]);
    });

    it('shows providers that are not active', async () => {
        const wrapper = await mountSearch({
            data: {
                forward: { enabled: true, providers: [osm] },
                reverse: { enabled: true, providers: [osm] },
                route: { enabled: false, providers: [] }
            },
            error: undefined
        });

        const providers = wrapper.findAll('.slidedown .slidedown');

        expect(providers[0].findAll('.badge').map(badge => badge.text())).toEqual(['Inactive']);
        expect(providers[1].findAll('.badge').map(badge => badge.text())).toEqual([
            'Forward', 'Reverse', 'Default', 'Active'
        ]);
    });

    it('still lists providers when the status cannot be loaded', async () => {
        const wrapper = await mountSearch({ data: undefined, error: { message: 'Search unavailable' } });

        expect(wrapper.findAll('.slidedown .slidedown')).toHaveLength(2);
        expect(wrapper.findAll('.badge')).toHaveLength(0);
        expect(wrapper.text()).toContain('Search unavailable');
    });

    it('loads and saves a provider configuration', async () => {
        const wrapper = await mountSearch({
            data: {
                forward: { enabled: false, providers: [] },
                reverse: { enabled: false, providers: [] },
                route: { enabled: false, providers: [] }
            },
            error: undefined
        }, {
            'osm::enabled': true,
            'osm::url': 'https://photon.example.com'
        });

        const provider = wrapper.findAll('.slidedown .slidedown')[1];

        await provider.find('.slidedown__header').trigger('click');
        await flushPromises();

        const keys = GET.mock.calls
            .filter(call => call[0] === '/api/config')
            .map(call => call[1].params.query.keys);

        expect(keys).toEqual(['osm::enabled,osm::url']);

        await provider.find('[title="Edit"]').trigger('click');
        await provider.find('[title="Save"]').trigger('click');
        await flushPromises();

        expect(PUT).toHaveBeenCalledWith('/api/config', {
            body: {
                'osm::enabled': true,
                'osm::url': 'https://photon.example.com'
            }
        });
    });
});
