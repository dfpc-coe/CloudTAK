import { createApp, watch } from 'vue'
import { PluginAPI } from '../plugin.ts';
import type { PluginStatic, PluginInstance } from '../plugin.ts'
import router from './router.ts'
import { createPinia } from 'pinia'
import { useMapStore } from './stores/map.ts';
import { isNativePlatform, supportsServiceWorker } from './base/capacitor.ts';
import { initServiceWorker } from './base/service-worker.ts';
import { initGlobalErrorReporting, vueErrorHandler } from './lib/reporting/index.ts';

initServiceWorker();
initGlobalErrorReporting();

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'
import { CapacitorUpdater } from '@capgo/capacitor-updater';

if (isNativePlatform()) {
    CapacitorUpdater.notifyAppReady()
}

// Catch failed resource loads (scripts, stylesheets, images) before Vue initialises.
// In production, the most common root cause is a stale SW serving a reference
// to an asset that no longer exists on the origin. We take a targeted
// recovery path: evict the failing URL and the cached shell, ask the SW to
// check for a newer registration, and reload. Recovery only runs while
// online (offline, the network cannot supply the asset either — a reload
// replays the identical failure forever) and at most once per cooldown
// window, so a reload that fixes nothing cannot loop. We intentionally do
// NOT `unregister()` or wipe every cache — doing so while offline deletes
// the only working copy of the app the user has.
const SW_RECOVERY_ATTEMPTED_KEY = 'sw-cache-recovery-attempted';
const SW_RECOVERY_COOLDOWN_MS = 60 * 1000;

// Only app build output (Vite emits hashed assets under /assets/) can be left
// dangling by a stale service worker. User-supplied content — e.g. <img> tags
// embedded in a KML feature description — is not part of the build, so its
// failure must never trigger a cache eviction + reload.
function isRecoverableAppAsset(url: string): boolean {
    try {
        const parsed = new URL(url, window.location.href);
        return parsed.origin === window.location.origin
            && parsed.pathname.startsWith('/assets/');
    } catch {
        return false;
    }
}

window.addEventListener('error', async (e) => {
    if (!e.target || e.target === window) return;

    const el = e.target as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    const url = (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || '';
    console.error('Failed to load resource:', (e.target as HTMLElement).tagName, url);

    if (import.meta.env.DEV || !supportsServiceWorker()) return;
    if (!url) return;
    if (!isRecoverableAppAsset(url)) return;

    // Offline the asset is unreachable no matter what we evict; reloading
    // just serves the same incomplete cache and fails the same way.
    // router.onError makes the same call for failed dynamic imports.
    if (!navigator.onLine) return;

    const lastAttempt = Number(sessionStorage.getItem(SW_RECOVERY_ATTEMPTED_KEY)) || 0;
    if (Date.now() - lastAttempt < SW_RECOVERY_COOLDOWN_MS) return;
    sessionStorage.setItem(SW_RECOVERY_ATTEMPTED_KEY, String(Date.now()));

    console.warn('Attempting targeted SW cache recovery for:', url);

    try {
        // Evict the failing URL and the cached shell from every cache
        // bucket we own. Dropping the shell matters: navigations are
        // cache-first, so without this the post-reload page is the same
        // stale HTML referencing the same dead asset. With it, the reload
        // fetches fresh HTML from the network, which references assets the
        // server can actually supply.
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(async (key) => {
            const cache = await caches.open(key);
            await cache.delete(url);
            await cache.delete('/');
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

app.config.errorHandler = vueErrorHandler;

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
