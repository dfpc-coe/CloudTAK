import { createApp, watch } from 'vue'
import { version } from '../package.json'
import { PluginAPI } from '../plugin.ts';
import type { PluginStatic, PluginInstance } from '../plugin.ts'
import router from './router.ts'
import { createPinia } from 'pinia'
import { useMapStore } from './stores/map.ts';
import { initServiceWorker } from './base/service-worker.ts';

initServiceWorker(version);

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'

// Catch failed resource loads (scripts, stylesheets, images) before Vue initialises.
// In production, the most common root cause is a stale SW serving a reference
// to an asset that no longer exists on the origin. We take a targeted
// recovery path: evict the failing URL from any cache, ask the SW to check
// for a newer registration, and reload ONCE per tab session. We intentionally
// do NOT `unregister()` or wipe every cache — doing so while offline deletes
// the only working copy of the app the user has.
const SW_RECOVERY_ATTEMPTED_KEY = 'sw-cache-recovery-attempted';

window.addEventListener('error', async (e) => {
    if (!e.target || e.target === window) return;

    const el = e.target as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    const url = (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || '';
    console.error('Failed to load resource:', (e.target as HTMLElement).tagName, url);

    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    if (sessionStorage.getItem(SW_RECOVERY_ATTEMPTED_KEY)) return;
    if (!url) return;

    sessionStorage.setItem(SW_RECOVERY_ATTEMPTED_KEY, '1');
    console.warn('Attempting targeted SW cache recovery for:', url);

    try {
        // Evict just the failing URL from every cache bucket we own, so
        // the next fetch goes to the network instead of replaying the
        // same bad cached reference.
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(async (key) => {
            const cache = await caches.open(key);
            await cache.delete(url);
        }));

        // Nudge the SW to re-check the registration; if a newer deploy
        // is out there, it will install and wait for a user prompt.
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.update().catch(() => {})));
    } catch (err) {
        console.error('Error during targeted SW cache recovery:', err);
    } finally {
        window.location.reload();
    }
}, true);

const app = createApp(App);
const pinia = createPinia()

app.use(router);
app.use(pinia);
app.use(FloatingVue);

const plugins: Record<string, {
    default: PluginStatic
}> = import.meta.glob(['../plugins/*.ts', '../plugins/*/index.ts'], {
    eager: true
});

const pluginAPI = new PluginAPI(app, router, pinia);
const pluginInstances: PluginInstance[] = [];

for (const path in plugins) {
    const instance = await plugins[path].default.install(app, pluginAPI);
    pluginInstances.push(instance);
}

const mapStore = useMapStore(pinia);
watch(() => mapStore.isLoaded, async (isLoaded) => {
    if (isLoaded) {
        for (const instance of pluginInstances) {
            await instance.enable();
        }
    } else {
        for (const instance of pluginInstances) {
            await instance.disable();
        }
    }
}, { immediate: true });

app.mount('#app');

// Successful mount means the critical path loaded. Clear the recovery
// guard so an *independent* resource failure later in the session can
// trigger recovery again instead of being silently swallowed.
if (!import.meta.env.DEV) {
    sessionStorage.removeItem(SW_RECOVERY_ATTEMPTED_KEY);
}
