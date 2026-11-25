import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { h, markRaw, ref } from 'vue';

const pluginItems = ref<{ key: string; component: unknown }[]>([]);
let initialized = false;

vi.mock('../../stores/map.ts', () => ({
    useMapStore: () => ({
        get bottomBar() {
            if (!initialized) throw new Error('BottomBar Manager has not yet initialized');
            return { pluginItems };
        }
    })
}));

import PluginPane from './PluginPane.vue';

describe('PluginPane', () => {
    it('mounts safely before the bottom bar manager is initialized', () => {
        initialized = false;

        expect(() => {
            mount(PluginPane);
        }).not.toThrow();
    });

    it('renders nothing until a plugin registers an item', async () => {
        initialized = true;
        pluginItems.value = [];

        const wrapper = mount(PluginPane);
        expect(wrapper.find('.plugin-pane').exists()).toBe(false);

        pluginItems.value = [{
            key: 'test',
            component: markRaw({ render: () => h('span', { class: 'plugin-item' }, 'Hello') })
        }];
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.plugin-pane').exists()).toBe(true);
        expect(wrapper.find('.plugin-item').exists()).toBe(true);
    });
});

describe('PluginPane: reporting that it is shown', () => {
    function mountPane(): { wrapper: ReturnType<typeof mount>; events: boolean[] } {
        const events: boolean[] = [];
        const wrapper = mount(PluginPane, { props: { onShown: (shown: boolean) => events.push(shown) } });
        return { wrapper, events };
    }

    const item = {
        key: 'weather',
        component: markRaw({ render: () => h('span', { class: 'plugin-item' }, 'Weather') })
    };

    it('reports that it is not shown before the bottom bar manager is initialized', () => {
        initialized = false;
        expect(mountPane().events.at(-1)).toBe(false);
    });

    it('reports that it is not shown while no plugin has an item', () => {
        initialized = true;
        pluginItems.value = [];
        expect(mountPane().events.at(-1)).toBe(false);
    });

    it('reports that it is shown once a plugin adds an item, and when it is gone again', async () => {
        initialized = true;
        pluginItems.value = [];
        const { events, wrapper } = mountPane();

        pluginItems.value = [item];
        await wrapper.vm.$nextTick();
        expect(events.at(-1)).toBe(true);

        pluginItems.value = [];
        await wrapper.vm.$nextTick();
        expect(events.at(-1)).toBe(false);
    });

    it('reports that it is gone when it is removed', () => {
        initialized = true;
        pluginItems.value = [item];
        const { events, wrapper } = mountPane();
        expect(events.at(-1)).toBe(true);

        wrapper.unmount();
        expect(events.at(-1)).toBe(false);
    });
});
