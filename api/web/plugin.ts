import type { App } from 'vue';

export interface PluginInstance {
}

export interface PluginStatic {
    install(
        app: App,
    ): PluginInstance;
}
