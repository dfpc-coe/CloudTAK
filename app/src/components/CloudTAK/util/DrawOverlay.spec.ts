import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h, reactive } from 'vue';
import { DrawToolMode } from '../../../stores/modules/draw.ts';

const appStore = reactive({ isMobileDetected: false });

vi.mock('../../../stores/app.ts', () => ({
    useAppStore: () => appStore
}));

const draw = reactive({
    mode: DrawToolMode.POINT,
    point: { type: 'u-d-p', icon: '', drop: 'single' },
    canFinish: false,
    snappingLayer: '',
    snappingOptions: [],
    lasso: { overlay: '' },
    finish: vi.fn(),
    stop: vi.fn(),
    populateSnappingLayers: vi.fn()
});

vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => ({ draw, hasSnapping: false })
}));

vi.mock('../../../base/overlay.ts', () => ({
    default: { queryableOverlayNames: () => [] }
}));

vi.mock('../../../utils/milsymbol.ts', () => ({
    symbolDataURL: () => 'data:image/svg+xml,'
}));

vi.mock('./IconSelectOffline.vue', () => ({
    default: {
        render(this: { $slots: { default?: () => unknown } }) {
            return h('div', { class: 'icon-select-stub' }, this.$slots.default?.() as never);
        }
    }
}));

import DrawOverlay from './DrawOverlay.vue';

describe('DrawOverlay point mode', () => {
    beforeEach(() => {
        appStore.isMobileDetected = false;
        draw.mode = DrawToolMode.POINT;
    });

    it.each([
        ['desktop', false],
        ['mobile', true],
    ])('puts the title and finish/cancel in a header row above the options on %s', (_label, mobile) => {
        appStore.isMobileDetected = mobile;
        const wrapper = mount(DrawOverlay);

        const header = wrapper.find('.card-header');
        const options = wrapper.find('.card-body');

        expect(header.text()).toBe('Draw Point');
        expect(header.find('[title="Finish Drawing"]').exists()).toBe(true);
        expect(header.find('[title="Cancel Editing"]').exists()).toBe(true);
        expect(header.find('input[name="point-type"]').exists()).toBe(false);
        expect(header.find('.icon-select-stub').exists()).toBe(false);

        expect(options.findAll('input[name="point-type"]')).toHaveLength(5);
        expect(options.find('.icon-select-stub').exists()).toBe(true);
        expect(options.find('[title="Drop Multiple Points"]').exists()).toBe(true);
        expect(wrapper.find('[title="Open Settings"]').exists()).toBe(false);
    });

    it('keeps the More toggle for line editing on mobile', () => {
        appStore.isMobileDetected = true;
        draw.mode = DrawToolMode.LINESTRING;
        const wrapper = mount(DrawOverlay);

        expect(wrapper.find('[title="Open Settings"]').exists()).toBe(true);
    });
});
