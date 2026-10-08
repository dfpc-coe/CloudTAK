import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent } from 'vue';

vi.mock('./map.ts', () => ({
    useMapStore: () => ({})
}));

import { useFloatStore } from './float.ts';

const Blank = defineComponent({ template: '<div />' });

function renderMenu(left: number): void {
    const menu = document.createElement('div');
    menu.className = 'cloudtak-main-menu';
    menu.getBoundingClientRect = () => ({ left } as DOMRect);
    document.body.appendChild(menu);
}

describe('float store placement', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.stubGlobal('innerWidth', 1200);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('opens top-left one gutter clear of the controls and top bar', () => {
        const pane = useFloatStore().add({ uid: 'a', component: Blank });

        expect(pane.x).toBe(56);
        expect(pane.y).toBe(76);
        expect(pane.width).toBe(400);
        expect(pane.height).toBe(300);
    });

    it('opens top-right one gutter clear of the menu panel', () => {
        renderMenu(792);
        const pane = useFloatStore().add({ uid: 'b', component: Blank, width: 500, corner: 'top-right' });

        // 792 menu edge - 8 gutter - 500 width
        expect(pane.x).toBe(284);
        expect(pane.y).toBe(76);
    });

    it('opens top-right one gutter clear of the viewport without a menu', () => {
        const pane = useFloatStore().add({ uid: 'b', component: Blank, corner: 'top-right' });

        // 1200 viewport - 8 gutter - 8 gutter - 400 width
        expect(pane.x).toBe(784);
    });

    it('never pushes a top-right pane past the left controls', () => {
        renderMenu(300);
        const pane = useFloatStore().add({ uid: 'c', component: Blank, corner: 'top-right' });

        expect(pane.x).toBe(56);
    });

    it('keeps explicit coordinates', () => {
        const pane = useFloatStore().add({ uid: 'd', component: Blank, x: 10, y: 20, corner: 'top-right' });

        expect(pane.x).toBe(10);
        expect(pane.y).toBe(20);
    });
});
