import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import * as VueTabler from '@tak-ps/vue-tabler';
import type { PluginAPI, PluginStatic, PluginInstance } from '../plugin.ts';
import { stdurl, getRuntimeToken } from './std.ts';
import type { Plugin } from './types.ts';
import { pluginUrl, listStoredPlugins, removeStoredPlugin } from './utils/plugin-store.ts';

let host: { app: Vue.App, api: PluginAPI } | undefined;
let enabled = false;

const instances = new Map<string, PluginInstance>();

/** Ids of the runtime plugins loaded in this session */
export const loadedPlugins = Vue.reactive(new Set<string>());

export function initPluginLoader(app: Vue.App, api: PluginAPI): void {
    host = { app, api };

    // Modules a plugin bundle takes from the host instead of bundling, keyed by import specifier
    Object.assign(globalThis, {
        __CLOUDTAK__: {
            'vue': Vue,
            'vue-router': VueRouter,
            '@tak-ps/vue-tabler': VueTabler
        }
    });
}

/** Enable or disable every installed plugin as the map loads and unloads */
export async function setPluginsEnabled(state: boolean): Promise<void> {
    enabled = state;

    for (const instance of instances.values()) {
        await (state ? instance.enable() : instance.disable());
    }
}

export async function installPlugin(id: string, plugin: PluginStatic): Promise<void> {
    if (!host) throw new Error('Plugin loader is not initialised');

    const instance = await plugin.install(host.app, host.api);
    if (enabled) await instance.enable();

    instances.set(id, instance);
}

export async function loadPlugin(plugin: Plugin): Promise<void> {
    if (instances.has(plugin.id)) return;
    if (!plugin.sha256) throw new Error(`${plugin.name} has no bundle`);

    const mod = await import(/* @vite-ignore */ await pluginUrl(plugin)) as { default?: PluginStatic };
    if (typeof mod.default?.install !== 'function') {
        throw new Error(`${plugin.name} does not export a CloudTAK plugin`);
    }

    await installPlugin(plugin.id, mod.default);
    loadedPlugins.add(plugin.id);
}

export async function unloadPlugin(id: string): Promise<void> {
    await removeStoredPlugin(id);

    const instance = instances.get(id);
    if (!instance) return;

    instances.delete(id);
    loadedPlugins.delete(id);

    await instance.disable();
}

/**
 * Unload and delete stored plugins the server has removed or disabled.
 * A plugin is kept whenever the server cannot be asked
 */
export async function reconcilePlugins(): Promise<void> {
    const token = await getRuntimeToken();
    if (!token) return;

    for (const plugin of await listStoredPlugins()) {
        try {
            const res = await fetch(stdurl(`/api/plugin/${plugin.id}`), {
                headers: { Authorization: `Bearer ${token}` }
            });

            const gone = res.status === 404
                || (res.ok && (await res.json() as Plugin).enabled === false);

            if (gone) await unloadPlugin(plugin.id);
        } catch (err) {
            console.warn(`Failed to check plugin '${plugin.name}'`, err);
        }
    }
}

/** Load every plugin stored on the device - storing one is the user's consent to run it */
export async function autoloadPlugins(): Promise<void> {
    for (const plugin of await listStoredPlugins()) {
        try {
            await loadPlugin(plugin);
        } catch (err) {
            console.error(`Failed to load plugin '${plugin.name}'`, err);
        }
    }
}
