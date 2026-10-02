import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();

vi.mock('../../../std.ts', () => ({
    server: { GET: (...args: unknown[]) => GET(...args) }
}));

vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => ({
        map: { getCenter: () => ({ lng: -105, lat: 39.7 }) },
        worker: { db: { filter: async () => new Set() } }
    })
}));

vi.mock('../../../base/cot.ts', () => ({ default: class COT {} }));
vi.mock('./FeatureRow.vue', () => ({ default: { template: '<div />' } }));

import SearchBox from './SearchBox.vue';

const icons: Record<string, string> = {
    address: 'tabler-icon-home',
    street: 'tabler-icon-road',
    poi: 'tabler-icon-map-pin-star',
    trailhead: 'tabler-icon-trekking',
    parking: 'tabler-icon-parking',
    hospital: 'tabler-icon-building-hospital',
    police: 'tabler-icon-shield',
    park: 'tabler-icon-trees',
    peak: 'tabler-icon-mountain',
    locality: 'tabler-icon-building-community',
    region: 'tabler-icon-map',
    postal: 'tabler-icon-mailbox'
};

async function search(items: Array<{ type?: string, text: string, magicKey: string, isCollection: boolean }>) {
    GET.mockResolvedValue({ data: { items }, error: undefined });

    const wrapper = mount(SearchBox);

    await wrapper.find('input').setValue('Denver');
    await flushPromises();

    return wrapper;
}

describe('CloudTAK/util/SearchBox', () => {
    afterEach(() => {
        GET.mockReset();
    });

    it('shows a distinct icon for every search type', async () => {
        const wrapper = await search(Object.keys(icons).map(type => ({
            type,
            text: `Result ${type}`,
            magicKey: `key-${type}`,
            isCollection: false
        })));

        const rows = wrapper.findAll('.standard-item');
        expect(rows).toHaveLength(Object.keys(icons).length);

        const rendered = rows.map(row => ({
            text: row.text(),
            icon: row.find('svg').classes().find(name => name.startsWith('tabler-icon-'))
        }));

        expect(rendered).toEqual(Object.entries(icons).map(([type, icon]) => ({
            text: `Result ${type}`,
            icon
        })));

        expect(new Set(rendered.map(row => row.icon)).size).toBe(Object.keys(icons).length);
    });

    it('falls back to a map pin when a result has no type', async () => {
        const wrapper = await search([{
            text: '200 E Colfax Ave, Denver, CO, 80203, USA',
            magicKey: 'arcgis-key',
            isCollection: false
        }]);

        const rows = wrapper.findAll('.standard-item');
        expect(rows).toHaveLength(1);
        expect(rows[0].find('svg').classes()).toContain('tabler-icon-map-pin');
    });
});
