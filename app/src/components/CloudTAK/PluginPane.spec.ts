import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

const items = ref<Array<{ key: string; component: ReturnType<typeof defineComponent> }>>([]);
vi.mock('../../stores/map.ts', () => ({
    useMapStore: () => ({ bottomBar: { pluginItems: items } })
}));

import PluginPane from './PluginPane.vue';

const Item = defineComponent({ render: () => h('span', 'Weather') });

function mountPane(): { wrapper: ReturnType<typeof mount>; events: boolean[] } {
    const events: boolean[] = [];
    const wrapper = mount(PluginPane, { props: { onShown: (shown: boolean) => events.push(shown) } });
    return { wrapper, events };
}

describe('PluginPane', () => {
    it('reports that it is not shown while no plugin has an item', () => {
        items.value = [];
        const { wrapper, events } = mountPane();
        expect(wrapper.find('.plugin-pane').exists()).toBe(false);
        expect(events.at(-1)).toBe(false);
    });

    it('reports that it is shown once a plugin adds an item, and when it is gone again', async () => {
        items.value = [];
        const { wrapper, events } = mountPane();

        items.value = [{ key: 'weather', component: Item }];
        await wrapper.vm.$nextTick();
        expect(wrapper.find('.plugin-pane').exists()).toBe(true);
        expect(events.at(-1)).toBe(true);

        items.value = [];
        await wrapper.vm.$nextTick();
        expect(events.at(-1)).toBe(false);
    });

    it('reports that it is gone when it is removed', () => {
        items.value = [{ key: 'weather', component: Item }];
        const { wrapper, events } = mountPane();
        expect(events.at(-1)).toBe(true);

        wrapper.unmount();
        expect(events.at(-1)).toBe(false);
    });
});
