import type { App } from 'vue';
import type { Router } from 'vue-router';
import type { Pinia } from 'pinia';

export interface PluginInstance {
    /**
     * Called after `install` if the server has the plugin enabled by default
     * or if the user has opted in to the plugin functionality
     */
    enable(): Promise<void>;

    /**
     * Called if the user disables the plugin, the plugin must
     * remove all functionality from the user facing app
     */
    disable(): Promise<void>;
}

export interface PluginStatic {
    /**
     * Hook called on init, note the plugin should not make itself
     * usable unless enable() is called.
     */
    install(
        app: App,
        api: PluginAPI
    ): PluginInstance;
}

/**
 * The Main Plugin API for managing CloudTAK UI functions
 */
export class PluginAPI {
    app: App;
    router: Router;
    pinia: Pinia;

    constructor(
        app: App,
        router: Router,
        pinia: Pinia
    ) {
        this.app = app;
        this.router = router;
        this.pinia = pinia;
    }
};
