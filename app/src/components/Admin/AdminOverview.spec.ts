import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const push = vi.fn();

vi.mock('../../std.ts', () => ({
    server: { GET: (...args: unknown[]) => GET(...args) }
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ push })
}));

import AdminOverview from './AdminOverview.vue';

const takserver = {
    id: 1,
    status: 'configured',
    connection_status: 'live',
    connection: true,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    version: '5.5',
    name: 'Test TAK Server',
    url: 'ssl://tak.example.com:8089',
    api: 'https://tak.example.com:8443',
    webtak: 'https://tak.example.com:8446',
    auth: true,
    certificate: {
        subject: 'CN=admin',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2027-01-01T00:00:00.000Z'
    }
};

const configured = {
    '/api/config': {
        data: {
            'media::url': 'https://video.example.com',
            'scim::enabled': true,
            'scim::token': 'token'
        },
        error: undefined
    },
    '/api/geofence': {
        data: { state: 'connected', enabled: true, configured: true, connected: true, url: 'wss://geofence.example.com', reconnectAttempts: 0 },
        error: undefined
    },
    '/api/search': {
        data: {
            reverse: { enabled: true, providers: [{ id: 'agol', name: 'ArcGIS Online' }, { id: 'osm', name: 'OpenStreetMap' }] },
            forward: { enabled: true, providers: [{ id: 'agol', name: 'ArcGIS Online' }, { id: 'osm', name: 'OpenStreetMap' }] },
            route: { enabled: true, providers: [{ id: 'agol', name: 'ArcGIS Online', modes: [] }] }
        },
        error: undefined
    }
};

const unconfigured = {
    '/api/config': {
        data: {},
        error: undefined
    },
    '/api/geofence': {
        data: { state: 'disabled', enabled: false, configured: false, connected: false, url: '', reconnectAttempts: 0 },
        error: undefined
    },
    '/api/search': {
        data: {
            reverse: { enabled: false, providers: [] },
            forward: { enabled: false, providers: [] },
            route: { enabled: false, providers: [] }
        },
        error: undefined
    },
    '/api/video/lease': {
        data: { total: 0, items: [] },
        error: undefined
    }
};

async function mountOverview(overrides: Record<string, unknown> = {}) {
    const totals: Record<string, number> = {
        '/api/user': 1234,
        '/api/connection': 12,
        '/api/layer': 34,
        '/api/integration': 5,
        '/api/import': 7,
        '/api/video/lease': 8,
        '/api/error': 9
    };

    const responses: Record<string, unknown> = {
        '/api/server': { data: takserver, error: undefined },
        ...configured,
        ...overrides
    };

    GET.mockImplementation(async (path: string) => {
        if (path in responses) return responses[path];
        return { data: { total: totals[path], items: [] }, error: undefined };
    });

    const wrapper = mount(AdminOverview, {
        global: { stubs: { TablerLoading: true, TablerRefreshButton: true, StatusDot: true } }
    });

    await flushPromises();

    return wrapper;
}

describe('Admin/AdminOverview', () => {
    afterEach(() => {
        GET.mockReset();
        push.mockReset();
    });

    it('renders the TAK Server status and a total for each section', async () => {
        const wrapper = await mountOverview();
        const server = wrapper.find('[data-overview="takserver"]');

        expect(server.text()).toContain('Connected');
        expect(server.text()).toContain('Test TAK Server');
        expect(server.text()).toContain('Certificate Expires');
        expect(server.classes()).toContain('border-success');

        const tiles = wrapper.findAll('[data-overview="tile"]');
        expect(tiles.map(tile => tile.text())).toEqual([
            `${(1234).toLocaleString()}Users`,
            '12Connections',
            '34Layers',
            '5Integrations',
            '7Failed User Imports',
            '9Error Reports'
        ]);
    });

    it('requests a single item per list and impersonates for user scoped lists', async () => {
        await mountOverview();

        const calls = new Map(GET.mock.calls.map(call => [call[0], call[1]?.params?.query]));

        expect(calls.get('/api/user').limit).toBe(1);
        expect(calls.get('/api/import')).toMatchObject({ impersonate: true, status: 'Fail' });
        expect(calls.get('/api/video/lease')).toMatchObject({ impersonate: true, expired: 'false', ephemeral: 'all' });
        expect(calls.has('/api/template/mission')).toBe(false);
    });

    it('navigates to the section when a tile is clicked', async () => {
        const wrapper = await mountOverview();

        await wrapper.findAll('[data-overview="tile"]')[0].trigger('click');
        expect(push).toHaveBeenCalledWith('/admin/user');

        await wrapper.find('[data-overview="takserver"]').trigger('click');
        expect(push).toHaveBeenCalledWith('/admin/server');

        await wrapper.findAll('[data-overview="service"]')[2].trigger('click');
        expect(push).toHaveBeenCalledWith('/admin/geofence');
    });

    it('renders configured services with a green border', async () => {
        const wrapper = await mountOverview();
        const services = wrapper.findAll('[data-overview="service"]');

        expect(services.map(service => service.text())).toEqual([
            'Video ServerConfigured8 Active Leases',
            'SCIMConfigured',
            'GeoFence ServerConfiguredConnected',
            'Search & GeocodingConfiguredArcGIS Online, OpenStreetMap',
            'RoutingConfiguredArcGIS Online'
        ]);

        for (const service of services) {
            expect(service.classes()).toContain('border-success');
            expect(service.classes()).not.toContain('border-danger');
            expect(service.find('svg').exists()).toBe(true);
        }
    });

    it('renders services that are not configured with a red border', async () => {
        const wrapper = await mountOverview(unconfigured);
        const services = wrapper.findAll('[data-overview="service"]');

        expect(services.map(service => service.text())).toEqual([
            'Video ServerNot Configured0 Active Leases',
            'SCIMNot Configured',
            'GeoFence ServerNot Configured',
            'Search & GeocodingNot Configured',
            'RoutingNot Configured'
        ]);

        for (const service of services) {
            expect(service.classes()).toContain('border-danger');
            expect(service.classes()).not.toContain('border-success');
            expect(service.find('svg').exists()).toBe(true);
        }
    });

    it('requires a token for SCIM to be configured', async () => {
        const wrapper = await mountOverview({
            '/api/config': { data: { 'scim::enabled': true, 'scim::token': '' }, error: undefined }
        });

        expect(wrapper.findAll('[data-overview="service"]')[1].text()).toBe('SCIMNot Configured');
    });

    it('keeps rendering when a single service fails', async () => {
        const wrapper = await mountOverview({
            '/api/geofence': { data: undefined, error: { message: 'Geofence unavailable' } }
        });

        const services = wrapper.findAll('[data-overview="service"]');

        expect(services[2].text()).toBe('GeoFence ServerGeofence unavailable');
        expect(services[2].classes()).not.toContain('border-success');
        expect(services[2].classes()).not.toContain('border-danger');
        expect(services[3].classes()).toContain('border-success');
    });

    it('reports search and routing independently', async () => {
        const wrapper = await mountOverview({
            '/api/search': {
                data: {
                    reverse: { enabled: true, providers: [{ id: 'osm', name: 'OpenStreetMap' }] },
                    forward: { enabled: true, providers: [{ id: 'osm', name: 'OpenStreetMap' }] },
                    route: { enabled: false, providers: [] }
                },
                error: undefined
            }
        });

        const services = wrapper.findAll('[data-overview="service"]');

        expect(services[3].text()).toBe('Search & GeocodingConfiguredOpenStreetMap');
        expect(services[3].classes()).toContain('border-success');
        expect(services[4].text()).toBe('RoutingNot Configured');
        expect(services[4].classes()).toContain('border-danger');
    });

    it('counts only failed user imports without highlighting them', async () => {
        const wrapper = await mountOverview();
        const tile = wrapper.findAll('[data-overview="tile"]')[4];

        expect(tile.text()).toBe('7Failed User Imports');
        expect(wrapper.findAll('[data-overview="tile"].text-danger')).toHaveLength(0);
        expect(tile.findAll('.text-danger')).toHaveLength(0);

        await tile.trigger('click');
        expect(push).toHaveBeenCalledWith('/admin/import?status=Fail');
    });

    it('keeps rendering when a single list fails', async () => {
        const wrapper = await mountOverview({
            '/api/layer': { data: undefined, error: { message: 'Layer list failed' } }
        });

        const tiles = wrapper.findAll('[data-overview="tile"]');
        expect(tiles[2].text()).toBe('-Layers');
        expect(tiles[2].find('.h2').attributes('title')).toBe('Layer list failed');
        expect(tiles[1].text()).toBe('12Connections');
    });

    it('borders the TAK Server by connection state', async () => {
        const cases: Array<[Record<string, unknown>, string, string]> = [
            [{ status: 'unconfigured', auth: false, certificate: undefined }, 'Not Configured', 'border-danger'],
            [{ auth: false, certificate: undefined }, 'No Admin Certificate', 'border-danger'],
            [{ connection: false }, 'Paused', 'border-warning'],
            [{ connection_status: 'dead' }, 'Disconnected', 'border-danger'],
        ];

        for (const [override, label, border] of cases) {
            const wrapper = await mountOverview({
                '/api/server': { data: { ...takserver, ...override }, error: undefined }
            });

            const server = wrapper.find('[data-overview="takserver"]');
            expect(server.text()).toContain(label);
            expect(server.classes()).toContain(border);
            expect(server.classes()).not.toContain('border-success');
        }

        const missing = await mountOverview({
            '/api/server': { data: { ...takserver, status: 'unconfigured', auth: false, certificate: undefined }, error: undefined }
        });
        expect(missing.find('[data-overview="takserver"]').text()).not.toContain('Certificate Expires');

        const failed = await mountOverview({
            '/api/server': { data: undefined, error: { message: 'Server unavailable' } }
        });
        expect(failed.find('[data-overview="takserver"]').text()).toContain('Server unavailable');
        expect(failed.find('[data-overview="takserver"]').classes()).toContain('border-danger');
    });
});
