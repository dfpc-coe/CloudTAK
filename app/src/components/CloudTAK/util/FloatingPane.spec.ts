import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';

const appStore = reactive({ isMobileDetected: false });

vi.mock('../../../stores/app.ts', () => ({
    useAppStore: () => appStore
}));

const pane = reactive({ uid: 'pane-1', height: 300, width: 400, x: 60, y: 70 });

vi.mock('../../../stores/float.ts', () => ({
    useFloatStore: () => ({ panes: new Map([[pane.uid, pane]]) })
}));

import FloatingPane from './FloatingPane.vue';

function mountPane() {
    return mount(FloatingPane, {
        props: { uid: pane.uid },
        attrs: { class: 'custom-class' },
        slots: {
            header: '<span data-test="header">Header</span>',
            actions: '<button data-test="action">Action</button>',
            default: '<div data-test="body">Body</div>'
        },
        attachTo: document.body
    });
}

describe('FloatingPane', () => {
    beforeEach(() => {
        appStore.isMobileDetected = false;
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            disconnect() {}
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('renders a draggable pane positioned from the store on desktop', () => {
        const wrapper = mountPane();

        const container = wrapper.find('.resizable-content');
        expect(container.exists()).toBe(true);
        expect(container.classes()).toContain('custom-class');
        expect((container.element as HTMLElement).style.top).toBe('70px');
        expect((container.element as HTMLElement).style.left).toBe('60px');
        expect((container.element as HTMLElement).style.width).toBe('400px');
        expect(document.querySelector('.modal')).toBeNull();
        expect(wrapper.find('[data-test="header"]').exists()).toBe(true);
        expect(wrapper.find('[data-test="action"]').exists()).toBe(true);
        expect(wrapper.find('[data-test="body"]').exists()).toBe(true);

        wrapper.unmount();
    });

    it('renders a modal with the same slots on mobile', () => {
        appStore.isMobileDetected = true;
        const wrapper = mountPane();

        expect(wrapper.find('.resizable-content').exists()).toBe(false);
        const modal = document.querySelector('.modal');
        expect(modal).not.toBeNull();
        expect(modal?.querySelector('.floating-pane-modal-frame')?.classList.contains('custom-class')).toBe(true);
        expect(modal?.querySelector('[data-test="header"]')).not.toBeNull();
        expect(modal?.querySelector('[data-test="action"]')).not.toBeNull();
        expect(modal?.querySelector('[data-test="body"]')).not.toBeNull();

        wrapper.unmount();
    });

    it('renders a modal on desktop when the modal prop is set', () => {
        const wrapper = mount(FloatingPane, {
            props: { uid: 'missing', modal: true },
            slots: { default: '<div data-test="body">Body</div>' },
            attachTo: document.body
        });

        expect(wrapper.find('.resizable-content').exists()).toBe(false);
        expect(document.querySelector('.modal [data-test="body"]')).not.toBeNull();

        wrapper.unmount();
    });

    it('emits close from both layouts', async () => {
        const wrapper = mountPane();

        await wrapper.find('[role="button"][title="Close Pane"]').trigger('click');
        expect(wrapper.emitted('close')).toHaveLength(1);

        appStore.isMobileDetected = true;
        await nextTick();

        (document.querySelector('.modal [role="button"][title="Close Pane"]') as HTMLElement).click();
        expect(wrapper.emitted('close')).toHaveLength(2);

        wrapper.unmount();
    });

    it('restores the stored position when switching back to desktop', async () => {
        appStore.isMobileDetected = true;
        const wrapper = mountPane();

        appStore.isMobileDetected = false;
        await nextTick();
        await nextTick();

        const container = wrapper.find('.resizable-content');
        expect(container.exists()).toBe(true);
        expect((container.element as HTMLElement).style.top).toBe('70px');
        expect((container.element as HTMLElement).style.left).toBe('60px');

        wrapper.unmount();
    });
});
