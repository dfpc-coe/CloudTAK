import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();

vi.mock('../../std.ts', () => ({
    server: { GET: (...args: unknown[]) => GET(...args) },
    stdurl: (url: string) => new URL(url, 'http://localhost')
}));

import AdminConfig from './AdminConfig.vue';

const ALL = [
    'Login Page',
    'Search Providers',
    'Routing Providers',
    'Media Server',
    'Plugin Proxy',
    'Retention',
    'Notifications',
    'Display Defaults',
    'External Applications',
    'Core Events',
    'TAK User Groups',
    'Map Settings',
    'COTAK OAuth Provider',
    'SCIM User Provisioning',
    'CoTURN Server'
];

function mountConfig(): VueWrapper {
    GET.mockResolvedValue({ data: undefined, error: { message: 'Not Loaded' } });

    return mount(AdminConfig, { attachTo: document.body });
}

function visible(wrapper: VueWrapper): string[] {
    return wrapper.findAll('.card-body > .slidedown')
        .filter(section => section.isVisible())
        .map(section => section.find('.slidedown__header label').text());
}

async function filter(wrapper: VueWrapper, value: string): Promise<void> {
    await wrapper.find('input').setValue(value);
}

describe('Admin/AdminConfig', () => {
    afterEach(() => {
        GET.mockReset();
        document.body.innerHTML = '';
    });

    it('lists every section in order by default', async () => {
        const wrapper = mountConfig();

        expect(visible(wrapper)).toEqual(ALL);
        expect(wrapper.text()).not.toContain('No Matching Settings');
    });

    it('shows an icon beside every section title', async () => {
        const wrapper = mountConfig();

        const headers = wrapper.findAll('.slidedown__header');
        expect(headers.length).toBeGreaterThanOrEqual(ALL.length);

        for (const header of headers) {
            expect(header.element.firstElementChild?.tagName.toLowerCase(), header.text()).toBe('svg');
        }
    });

    it('groups the search providers under a single section', async () => {
        const wrapper = mountConfig();

        expect(visible(wrapper)).not.toContain('ArcGIS Online');
        expect(visible(wrapper)).not.toContain('OpenStreetMap');
    });

    it('filters sections by name regardless of case', async () => {
        const wrapper = mountConfig();

        await filter(wrapper, 'providers');
        expect(visible(wrapper)).toEqual(['Search Providers', 'Routing Providers']);

        await filter(wrapper, 'RETENTION');
        expect(visible(wrapper)).toEqual(['Retention']);
    });

    it('filters sections by the settings they contain', async () => {
        const wrapper = mountConfig();

        await filter(wrapper, 'photon');
        expect(visible(wrapper)).toEqual(['Search Providers']);

        await filter(wrapper, 'arcgis');
        expect(visible(wrapper)).toEqual(['Search Providers', 'Routing Providers']);

        await filter(wrapper, 'firebase');
        expect(visible(wrapper)).toEqual(['Notifications']);
    });

    it('requires every term to match', async () => {
        const wrapper = mountConfig();

        await filter(wrapper, 'arcgis routing');
        expect(visible(wrapper)).toEqual(['Routing Providers']);
    });

    it('shows an empty state and recovers when cleared', async () => {
        const wrapper = mountConfig();

        await filter(wrapper, 'nothing matches this');
        expect(visible(wrapper)).toEqual([]);
        expect(wrapper.text()).toContain('No Matching Settings');

        await filter(wrapper, '   ');
        expect(visible(wrapper)).toEqual(ALL);
        expect(wrapper.text()).not.toContain('No Matching Settings');
    });

    it('keeps a section open while it is filtered out', async () => {
        const wrapper = mountConfig();

        const section = wrapper.findAll('.card-body > .slidedown')[5];
        await section.find('.slidedown__header').trigger('click');
        expect(section.classes()).toContain('slidedown--expanded');

        await filter(wrapper, 'photon');
        expect(section.isVisible()).toBe(false);

        await filter(wrapper, '');
        expect(section.isVisible()).toBe(true);
        expect(section.classes()).toContain('slidedown--expanded');
    });
});
