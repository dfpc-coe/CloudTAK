import type { App } from 'vue';
import type { PluginAPI, PluginInstance } from '../plugin.ts';

export default class ExamplePlugin implements PluginInstance {
    api: PluginAPI;

    constructor(api: PluginAPI) {
        this.api = api;
    }

    static async install(
        app: App,
        api: PluginAPI
    ): Promise<PluginInstance> {
        return new Test(api);
    }

    async enable(): Promise<void> {
        console.log('Plugin Loaded');
    }

    async disable(): Promise<void> {
        console.log('Plugin Unloaded');
    }
}
