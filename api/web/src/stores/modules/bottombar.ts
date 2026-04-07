import { markRaw, ref } from 'vue';
import type { Component, Ref } from 'vue';

export type BottomBarItemConfig = {
    /** Unique identifier for the item */
    key: string;
    /** Vue component rendered in the centre of the bottom status bar */
    component: Component;
};

/**
 * Manages plugin-registered components displayed in the centre of the map status bar
 */
export default class BottomBarManager {
    pluginItems: Ref<BottomBarItemConfig[]>;

    constructor() {
        this.pluginItems = ref<BottomBarItemConfig[]>([]);
    }

    /**
     * Add a component to the centre of the bottom status bar
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
     * Remove a previously registered bottom bar component by key
     */
    removeItem(key: string) {
        this.pluginItems.value = this.pluginItems.value.filter((i) => i.key !== key);
    }
}
