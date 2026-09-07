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
