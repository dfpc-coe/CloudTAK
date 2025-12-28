import type { Component } from "vue";

/**
 * Manage Pluggable Menu
 */
export default class MenuManager {
    private menu: Array<{
        key: string,
        label: string,
        route: string,
        tooltip: string,
        description: string,
        icon: Component
    }>;

    constructor() {
        this.menu = [];
    }
}
