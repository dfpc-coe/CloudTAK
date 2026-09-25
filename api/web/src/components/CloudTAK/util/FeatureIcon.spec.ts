import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const mapStore = vi.hoisted(() => ({
    _map: undefined as object | undefined,
    map: {
        getImage: vi.fn<(id: string) => object | undefined>(() => undefined)
    },
    icons: {
        resolvable: vi.fn<(id: string) => boolean>(() => true),
        resolve: vi.fn<(id: string) => Promise<void>>(async () => {})
    }
}));

vi.mock('../../../stores/map.ts', () => ({ useMapStore: () => mapStore }));

// jsdom has no 2D canvas - the draw step is skipped, not under test
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);

import FeatureIcon from './FeatureIcon.vue';

const feature = {
    properties: { type: 'u-d-p' },
    geometry: { type: 'Point', coordinates: [0, 0] },
};

describe('FeatureIcon', () => {
    it('only overlays the error marker when error is set', async () => {
        const wrapper = mount(FeatureIcon, { props: { feature } });

        expect(wrapper.find('.feature-icon__error').exists()).toBe(false);

        await wrapper.setProps({ error: true });

        expect(wrapper.find('.feature-icon__error').exists()).toBe(true);
    });

    it('requests the same marker-color image the map draws', async () => {
        mapStore._map = {};

        const image = { data: { data: new Uint8ClampedArray(4), width: 1, height: 1 } };
        mapStore.map.getImage.mockImplementation((id) => id === 'a-f-G-U-C-I-colored-00FF00' ? image : undefined);

        const wrapper = mount(FeatureIcon, {
            props: {
                feature: {
                    properties: { type: 'a-f-G-U-C-I', 'marker-color': '#00FF00' },
                    geometry: { type: 'Point', coordinates: [0, 0] },
                }
            }
        });

        await wrapper.vm.$nextTick();

        expect(wrapper.find('canvas').exists()).toBe(true);
        expect(mapStore.map.getImage).toHaveBeenCalledWith('a-f-G-U-C-I-colored-00FF00');
        expect(mapStore.map.getImage).not.toHaveBeenCalledWith('a-f-G-U-C-I');
        expect(mapStore.icons.resolve).not.toHaveBeenCalled();
    });

    it('asks the Icon Manager for an image the map has not drawn yet', async () => {
        mapStore._map = {};
        mapStore.map.getImage.mockImplementation(() => undefined);
        mapStore.icons.resolve.mockClear();

        mount(FeatureIcon, {
            props: {
                feature: {
                    properties: { type: 'a-f-G', icon: 'uid:Vehicle/Ambulance', 'marker-color': '#ff0000' },
                    geometry: { type: 'Point', coordinates: [0, 0] },
                }
            }
        });

        expect(mapStore.icons.resolve).toHaveBeenCalledWith('uid:Vehicle/Ambulance-colored-ff0000');
    });
});
