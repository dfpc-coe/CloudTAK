import { markRaw, ref } from 'vue';
import type { Component, Ref } from 'vue';

export type BottomBarItemConfig = {
    /** Unique identifier for the item */
    key: string;
    /** Vue component rendered in the floating plugin pane at the bottom centre of the map */
    component: Component;
};

/**
 * Manages plugin-registered components displayed in the floating plugin pane
 */
export default class BottomBarManager {
    pluginItems: Ref<BottomBarItemConfig[]>;

    constructor() {
        this.pluginItems = ref<BottomBarItemConfig[]>([]);
    }

    /**
     * Add a component to the floating plugin pane
     */
    addItem(item: BottomBarItemConfig) {
        if (this.pluginItems.value.find((i) => i.key === item.key)) {
            console.warn(`BottomBar item with key '${item.key}' already exists — skipping`);
            return;
        }
        this.pluginItems.value.push({
            ...item,
            component: markRaw(item.component)
        });
    }

    /**
     * Remove a previously registered plugin pane component by key
     */
    removeItem(key: string) {
        this.pluginItems.value = this.pluginItems.value.filter((i) => i.key !== key);
    }
}
