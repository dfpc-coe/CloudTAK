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
                window.location.reload()
                refreshing = true
            }
        })
    });
}

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'

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
