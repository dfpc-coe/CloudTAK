import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent } from 'vue';

const mapStore = { toastOffset: { x: 424, y: 60 } };

vi.mock('./map.ts', () => ({
    useMapStore: () => mapStore
}));

import { useFloatStore } from './float.ts';

const Blank = defineComponent({ template: '<div />' });

describe('float store placement', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.stubGlobal('innerWidth', 1200);
    });

    it('opens top-left one gutter clear of the controls and top bar', () => {
        const pane = useFloatStore().add({ uid: 'a', component: Blank });

        expect(pane.x).toBe(56);
        expect(pane.y).toBe(76);
        expect(pane.width).toBe(400);
        expect(pane.height).toBe(300);
    });

    it('opens top-right one gutter clear of the visible menu edge', () => {
        const pane = useFloatStore().add({ uid: 'b', component: Blank, width: 500, corner: 'top-right' });

        // 1200 viewport - (424 - 10) menu - 8 gutter - 500 width
        expect(pane.x).toBe(278);
        expect(pane.y).toBe(76);
    });

    it('never pushes a top-right pane past the left controls', () => {
        vi.stubGlobal('innerWidth', 700);
        const pane = useFloatStore().add({ uid: 'c', component: Blank, corner: 'top-right' });

        expect(pane.x).toBe(56);
    });

    it('keeps explicit coordinates', () => {
        const pane = useFloatStore().add({ uid: 'd', component: Blank, x: 10, y: 20, corner: 'top-right' });

        expect(pane.x).toBe(10);
        expect(pane.y).toBe(20);
    });
});
