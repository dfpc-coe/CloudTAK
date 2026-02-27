import { createApp, watch } from 'vue'
import { version } from '../package.json'
import { PluginAPI } from '../plugin.ts';
import type { PluginStatic, PluginInstance } from '../plugin.ts'
import router from './router.ts'
import { createPinia } from 'pinia'
import { useMapStore } from './stores/map.ts';

if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`/sw.js?v=${version}&build=${import.meta.env.HASH}`).then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, (err) => {
            console.log('ServiceWorker registration failed: ', err);
        });

        let refreshing = false;

        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
                refreshing = true;
                // Dispatch a cancelable event so that page components (e.g. Login)
                // can call preventDefault() to show their own upgrade prompt instead
                // of reloading silently.  When nothing cancels the event, reload.
                const notCancelled = window.dispatchEvent(new CustomEvent('sw:updated', { cancelable: true }));
                if (notCancelled) {
                    window.location.reload();
                }
            }
        })
    });
}

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'

// Catch failed resource loads (scripts, stylesheets, images) before Vue initialises.
// In production, a stale service worker cache is a common cause — purge and reload once.
window.addEventListener('error', async (e) => {
    if (!e.target || e.target === window) return;

    const el = e.target as HTMLScriptElement | HTMLLinkElement | HTMLImageElement;
    const url = (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || '';
    console.error('Failed to load resource:', (e.target as HTMLElement).tagName, url);

    if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
        if (sessionStorage.getItem('sw-cache-purged')) return;

        sessionStorage.setItem('sw-cache-purged', '1');
        console.warn('Purging service worker cache and reloading due to resource load failure');

        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((r) => r.unregister()));

            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((k) => caches.delete(k)));
        } catch (err) {
            console.error('Error while purging service worker cache:', err);
        } finally {
            window.location.reload();
        }
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
