import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const push = vi.fn();
const overlayList = vi.fn(async () => [] as unknown[]);
const loadedFrom = vi.fn();
const flyTo = vi.fn();
const fitBounds = vi.fn();
const dbAdd = vi.fn();
const dbSearch = vi.fn<(query: string, opts: unknown) => Promise<Set<unknown>>>(async () => new Set());

vi.mock('../../../std.ts', () => ({
    server: { GET: (...args: unknown[]) => GET(...args) }
}));

vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => ({
        map: {
            getCenter: () => ({ lng: -105, lat: 39.7 }),
            flyTo,
            fitBounds
        },
        worker: {
            db: { search: dbSearch, add: dbAdd },
            profile: { creator: async () => ({ uid: 'me', callsign: 'Me', type: 'a-f-G' }) }
        }
    })
}));

vi.mock('../../../base/cot.ts', () => ({ default: class COT {} }));
vi.mock('../../../base/overlay.ts', () => ({
    default: {
        list: (...args: unknown[]) => overlayList(...args as []),
        loadedFrom: (id: unknown) => loadedFrom(id)
    }
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('./FeatureRow.vue', () => ({
    default: {
        props: ['feature', 'detail'],
        template: '<div class="feature-row-stub"><span v-text="feature.properties.callsign" /><span v-if="detail" class="feature-row-detail" v-text="detail" /></div>'
    }
}));

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

type Suggestion = { type?: string, text: string, magicKey: string, isCollection: boolean };

async function search(items: Array<Suggestion>, query = 'Denver') {
    GET.mockResolvedValue({ data: { items }, error: undefined });

    const wrapper = mount(SearchBox);

    await wrapper.find('input').setValue(query);
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    return wrapper;
}

function labels(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('[role="option"]').map(row => row.find('.fw-semibold, .feature-row-stub > span').text());
}

describe('CloudTAK/util/SearchBox', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        GET.mockReset();
        flyTo.mockReset();
        fitBounds.mockReset();
        dbAdd.mockReset();
        dbSearch.mockClear();
        push.mockReset();
        loadedFrom.mockReset();
        overlayList.mockReset();
        overlayList.mockResolvedValue([]);
    });

    it('shows a distinct icon for every search type', async () => {
        const wrapper = await search(Object.keys(icons).map(type => ({
            type,
            text: `Result ${type}`,
            magicKey: `key-${type}`,
            isCollection: false
        })));

        const rows = wrapper.findAll('[role="option"]');
        expect(rows).toHaveLength(Object.keys(icons).length);

        const rendered = rows.map(row => ({
            text: row.find('.fw-semibold').text(),
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

        const rows = wrapper.findAll('[role="option"]');
        expect(rows).toHaveLength(1);
        expect(rows[0].find('svg').classes()).toContain('tabler-icon-map-pin');
    });

    it('debounces suggestions until typing pauses', async () => {
        GET.mockResolvedValue({ data: { items: [] }, error: undefined });

        const wrapper = mount(SearchBox);
        const input = wrapper.find('input');

        await input.setValue('D');
        await input.setValue('De');
        await input.setValue('Den');
        await vi.advanceTimersByTimeAsync(100);

        expect(GET).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(200);
        await flushPromises();

        expect(GET).toHaveBeenCalledTimes(1);
        expect(GET.mock.calls[0][1].params.query.query).toBe('Den');
    });

    it('highlights the first result and moves with the arrow keys', async () => {
        const wrapper = await search([
            { text: 'Denver, CO', magicKey: 'a', isCollection: false },
            { text: 'Denver International Airport', magicKey: 'b', isCollection: false },
            { text: 'Denver Zoo', magicKey: 'c', isCollection: false }
        ]);

        const input = wrapper.find('input');
        const active = () => wrapper.find('[aria-selected="true"] .fw-semibold').text();

        expect(active()).toBe('Denver, CO');

        await input.trigger('keydown', { key: 'ArrowDown' });
        expect(active()).toBe('Denver International Airport');

        await input.trigger('keydown', { key: 'ArrowDown' });
        await input.trigger('keydown', { key: 'ArrowDown' });
        expect(active()).toBe('Denver, CO');

        await input.trigger('keydown', { key: 'ArrowUp' });
        expect(active()).toBe('Denver Zoo');
    });

    it('selects the highlighted result with Enter', async () => {
        const wrapper = await search([
            { text: 'Denver, CO', magicKey: 'a', isCollection: false },
            { text: 'Denver Zoo', magicKey: 'b', isCollection: false }
        ]);

        GET.mockResolvedValue({
            data: {
                items: [{
                    address: 'Denver Zoo, 2300 Steele St, Denver, CO',
                    location: { x: -104.95, y: 39.75 },
                    score: 100,
                    attributes: {},
                    extent: { xmin: -104.96, ymin: 39.74, xmax: -104.94, ymax: 39.76 }
                }]
            },
            error: undefined
        });

        const input = wrapper.find('input');
        await input.trigger('keydown', { key: 'ArrowDown' });
        await input.trigger('keydown', { key: 'Enter' });
        await flushPromises();

        expect(GET).toHaveBeenLastCalledWith('/api/search/forward', expect.objectContaining({
            params: { query: expect.objectContaining({ query: 'Denver Zoo', magicKey: 'b' }) }
        }));
        expect(fitBounds).toHaveBeenCalledTimes(1);
        expect(dbAdd).toHaveBeenCalledTimes(1);
        expect(dbAdd.mock.calls[0][0].properties.callsign).toBe('Denver Zoo');

        expect(wrapper.emitted('select')).toEqual([[{
            name: 'Denver Zoo, 2300 Steele St, Denver, CO',
            coordinates: [-104.95, 39.75]
        }]]);

        expect((input.element as HTMLInputElement).value).toBe('Denver Zoo, 2300 Steele St, Denver, CO');
        expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    });

    it('renders map features with the Feature component and selects them with Enter', async () => {
        const cot = {
            id: 'cot-1',
            properties: { callsign: 'DENVER-1', center: [-104.9, 39.7] },
            flyTo: vi.fn(async () => undefined)
        };
        dbSearch.mockResolvedValueOnce(new Set([cot]) as never);

        const wrapper = await search([
            { text: 'Denver, CO', magicKey: 'a', isCollection: false }
        ]);

        expect(dbSearch).toHaveBeenCalledTimes(1);
        expect(dbSearch).toHaveBeenCalledWith('denver', { mission: true, limit: 5 });

        expect(labels(wrapper)).toEqual(['DENVER-1', 'Denver, CO']);
        expect(wrapper.find('.feature-row-stub').text()).toBe('DENVER-1');
        expect(wrapper.find('[aria-selected="true"] .feature-row-stub').exists()).toBe(true);

        await wrapper.find('input').trigger('keydown', { key: 'Enter' });
        await flushPromises();

        expect(cot.flyTo).toHaveBeenCalledTimes(1);
        expect(GET).toHaveBeenCalledTimes(1);
        expect(wrapper.emitted('select')).toEqual([[{
            name: 'DENVER-1',
            coordinates: [-104.9, 39.7]
        }]]);
    });

    it('lists remark matches after callsign matches with a snippet of the remark', async () => {
        const byCallsign = {
            id: 'cot-callsign',
            properties: { callsign: 'Phone Tree', center: [-104.9, 39.7] }
        };
        const byRemarks = {
            id: 'cot-remarks',
            properties: {
                callsign: '123 Main St',
                remarks: 'Occupant   has a generator.\nPhone: 555-0100, call before 9pm. Has a chainsaw and a truck.',
                center: [-104.8, 39.6]
            }
        };
        dbSearch.mockResolvedValueOnce(new Set([byCallsign, byRemarks]) as never);

        const wrapper = await search([], 'phone');

        expect(labels(wrapper)).toEqual(['Phone Tree', '123 Main St']);

        const details = wrapper.findAll('.feature-row-detail').map(el => el.text());
        expect(details).toEqual(['Occupant has a generator. Phone: 555-0100, call before 9pm. Has a chainsaw and a truck.']);
    });

    it('trims long remarks around the match', async () => {
        const cot = {
            id: 'cot-long',
            properties: {
                callsign: 'Lot 9',
                remarks: `${'a'.repeat(50)} needs "water" ${'b'.repeat(80)}`,
                center: [-104.8, 39.6]
            }
        };
        dbSearch.mockResolvedValueOnce(new Set([cot]) as never);

        const wrapper = await search([], '"water"');

        expect(wrapper.find('.feature-row-detail').text()).toBe(`…${'a'.repeat(23)} needs "water" ${'b'.repeat(59)}…`);
    });

    it('offers a parsed coordinate without calling the search API', async () => {
        const wrapper = await search([], '39.7392, -104.9903');

        expect(GET).not.toHaveBeenCalled();
        expect(labels(wrapper)).toEqual(['39.73920, -104.99030']);

        await wrapper.find('input').trigger('keydown', { key: 'Enter' });
        await flushPromises();

        expect(flyTo).toHaveBeenCalledWith({ center: [-104.9903, 39.7392], zoom: 15 });
        expect(dbAdd).toHaveBeenCalledTimes(1);
        expect(wrapper.emitted('select')).toEqual([[{
            name: '39.73920, -104.99030',
            coordinates: [-104.9903, 39.7392]
        }]]);
    });

    it('only searches overlays when enabled', async () => {
        await search([{ text: 'Denver, CO', magicKey: 'a', isCollection: false }]);

        expect(overlayList).not.toHaveBeenCalled();
    });

    it('lists matching overlays and zooms to a loaded one on Enter', async () => {
        const overlay = { id: 7, name: 'Denver Parcels', type: 'vector', mode: 'profile', visible: false };
        overlayList.mockResolvedValue([overlay]);

        const loaded = {
            visible: false,
            update: vi.fn(async () => undefined),
            hasBounds: () => true,
            zoomTo: vi.fn(async () => undefined)
        };
        loadedFrom.mockReturnValue(loaded);

        GET.mockResolvedValue({ data: { items: [] }, error: undefined });

        const wrapper = mount(SearchBox, { props: { overlays: true } });
        await wrapper.find('input').setValue('Denver');
        await vi.advanceTimersByTimeAsync(250);
        await flushPromises();

        expect(overlayList).toHaveBeenCalledWith({ filter: 'Denver', localFirst: true, limit: 5 });
        expect(labels(wrapper)).toEqual(['Denver Parcels']);
        expect(wrapper.find('[role="option"] .text-secondary').text()).toBe('Vector · Hidden');

        await wrapper.find('input').trigger('keydown', { key: 'Enter' });
        await flushPromises();

        expect(loadedFrom).toHaveBeenCalledWith(7);
        expect(loaded.update).toHaveBeenCalledWith({ visible: true });
        expect(loaded.zoomTo).toHaveBeenCalledTimes(1);
        expect(push).not.toHaveBeenCalled();
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('opens the overlay menu for an overlay that is not on the map', async () => {
        overlayList.mockResolvedValue([{ id: 9, name: 'Archived Imagery', type: 'raster', mode: 'profile', visible: true }]);
        loadedFrom.mockReturnValue(undefined);
        GET.mockResolvedValue({ data: { items: [] }, error: undefined });

        const wrapper = mount(SearchBox, { props: { overlays: true } });
        await wrapper.find('input').setValue('Imagery');
        await vi.advanceTimersByTimeAsync(250);
        await flushPromises();

        await wrapper.find('[role="option"]').trigger('click');
        await flushPromises();

        expect(push).toHaveBeenCalledWith('/menu/overlays');
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('renders the panel variant with an empty state and keyboard hints', async () => {
        const wrapper = mount(SearchBox, { props: { variant: 'panel' } });

        expect(wrapper.find('.search-box--panel').exists()).toBe(true);
        expect(wrapper.find('.empty').exists()).toBe(true);
        expect(wrapper.find('.search-box__footer').text()).toContain('Navigate');
    });
});
