import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { DrawToolMode } from '../../../stores/modules/draw.ts';

const appStore = reactive({ isMobileDetected: false });

vi.mock('../../../stores/app.ts', () => ({
    useAppStore: () => appStore
}));

const draw = reactive({
    mode: DrawToolMode.POINT,
    point: { type: 'u-d-p' },
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

import DrawOverlay from './DrawOverlay.vue';

describe('DrawOverlay point mode', () => {
    beforeEach(() => {
        appStore.isMobileDetected = false;
        draw.mode = DrawToolMode.POINT;
    });

    it.each([
        ['desktop', false],
        ['mobile', true],
    ])('stacks a thin label above every marker type on %s', (_label, mobile) => {
        appStore.isMobileDetected = mobile;
        const wrapper = mount(DrawOverlay);

        expect(wrapper.find('.card-header .flex-column .point-label').text()).toBe('Draw Point');
        expect(wrapper.findAll('.card-header input[name="point-type"]')).toHaveLength(5);
        expect(wrapper.find('.card-body').exists()).toBe(false);
        expect(wrapper.find('[title="Open Settings"]').exists()).toBe(false);
        expect(wrapper.find('[title="Finish Drawing"]').exists()).toBe(true);
        expect(wrapper.find('[title="Cancel Editing"]').exists()).toBe(true);
    });

    it('keeps the More toggle for line editing on mobile', () => {
        appStore.isMobileDetected = true;
        draw.mode = DrawToolMode.LINESTRING;
        const wrapper = mount(DrawOverlay);

        expect(wrapper.find('[title="Open Settings"]').exists()).toBe(true);
    });
});
