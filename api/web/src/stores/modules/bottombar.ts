import { ref } from 'vue';
import type { Component, Ref } from 'vue';

export type BottomBarItemConfig = {
    /** Unique identifier for the item */
    key: string;
    /** Tooltip text shown on hover */
    tooltip: string;
    /** Tabler (or any Vue) icon component */
    icon: Component;
    /** Called when the icon is clicked */
    onClick: () => void;
};

/**
 * Manages plugin-registered icons displayed in the centre of the map status bar
 */
export default class BottomBarManager {
    pluginItems: Ref<BottomBarItemConfig[]>;

    constructor() {
        this.pluginItems = ref([]);
    }

    /**
     * Add an icon button to the centre of the bottom status bar
     */
    addItem(item: BottomBarItemConfig) {
        if (this.pluginItems.value.find((i) => i.key === item.key)) {
            console.warn(`BottomBar item with key '${item.key}' already exists — skipping`);
            return;
        }
        this.pluginItems.value.push(item);
    }

    /**
     * Remove a previously registered icon button by key
     */
    removeItem(key: string) {
        this.pluginItems.value = this.pluginItems.value.filter((i) => i.key !== key);
    }
}
