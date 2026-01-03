import { createApp, watch } from 'vue'
import { version } from '../package.json'
import { PluginAPI } from '../plugin.ts';
import type { PluginStatic, PluginInstance } from '../plugin.ts'
import * as VueRouter from 'vue-router'
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

// Intentially not dynamic import to ensure it's included in the build
// It contains a utility to hard reload the app
import Login from './components/Login.vue'
import MenuSettings from './components/CloudTAK/Menu/MenuSettings.vue'

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('./components/Home.vue'),
            children: [{
                path: 'query/:coords',
                name: 'home-menu-query',
                component: () => import('./components/CloudTAK/QueryView.vue'),
            },{
                path: 'cot/:uid',
                name: 'home-menu-cot',
                component: () => import('./components/CloudTAK/CoTView.vue'),
            },{
                path: 'menu',
                name: 'home-menu',
                children: [{
                    path: 'settings',
                    name: 'home-menu-settings',
                    component: MenuSettings
                },{
                    path: 'settings/tokens',
                    name: 'home-menu-settings-tokens',
                    component: () => import('./components/CloudTAK/Menu/MenuSettingsTokens.vue')
                },{
                    path: 'settings/callsign',
                    name: 'home-menu-settings-callsign',
                    component: () => import('./components/CloudTAK/Menu/MenuSettingsCallsign.vue')
                },{
                    path: 'settings/display',
                    name: 'home-menu-settings-display',
                    component: () => import('./components/CloudTAK/Menu/MenuSettingsDisplay.vue')
                },{
                    path: 'imports',
                    name: 'home-menu-imports',
                    component: () => import('./components/CloudTAK/Menu/MenuImports.vue')
                },{
                    path: 'files',
                    name: 'home-menu-files',
                    component: () => import('./components/CloudTAK/Menu/MenuFiles.vue')
                },{
                    path: 'packages',
                    name: 'home-menu-packages',
                    component: () => import('./components/CloudTAK/Menu/MenuPackages.vue')
                },{
                    path: 'connections',
                    name: 'home-menu-connections',
                    component: () => import('./components/CloudTAK/Menu/MenuConnections.vue')
                },{
                    path: 'videos',
                    name: 'home-menu-videos',
                    component: () => import('./components/CloudTAK/Menu/MenuVideos.vue')
                },{
                    path: 'videos/remote/:connectionid',
                    name: 'home-menu-videos-remote-new',
                    component: () => import('./components/CloudTAK/Menu/MenuVideosRemote.vue')
                },{
                    path: 'debugger',
                    name: 'home-menu-debugger',
                    component: () => import('./components/CloudTAK/Menu/Debugger.vue')
                },{
                    path: 'packages/:package',
                    name: 'home-menu-package',
                    component: () => import('./components/CloudTAK/Menu/MenuPackage.vue')
                },{
                    path: 'imports/:import',
                    name: 'home-menu-import',
                    component: () => import('./components/CloudTAK/Menu/MenuImport.vue')
                },{
                    path: 'basemaps',
                    name: 'home-menu-basemaps',
                    component: () => import('./components/CloudTAK/Menu/MenuBasemaps.vue')
                },{
                    path: 'iconsets',
                    name: 'home-menu-iconsets',
                    component: () => import('./components/CloudTAK/Menu/MenuIconsets.vue')
                },{
                    path: 'iconset/:iconset',
                    name: 'home-menu-iconset',
                    component: () => import('./components/CloudTAK/Menu/MenuIconset.vue')
                },{
                    path: 'iconset/:iconset/:icon',
                    name: 'home-menu-iconset-icon',
                    component: () => import('./components/CloudTAK/Menu/MenuIcon.vue')
                },{
                    path: 'features',
                    name: 'home-menu-features',
                    component: () => import('./components/CloudTAK/Menu/MenuFeatures.vue')
                },{
                    path: 'features/deleted',
                    name: 'home-menu-features-deleted',
                    component: () => import('./components/CloudTAK/Menu/MenuFeaturesDeleted.vue')
                },{
                    path: 'overlays',
                    name: 'home-menu-overlays',
                    component: () => import('./components/CloudTAK/Menu/MenuOverlays.vue')
                },{
                    path: 'datas',
                    name: 'home-menu-datas',
                    component: () => import('./components/CloudTAK/Menu/MenuOverlayExplorer.vue')
                },{
                    path: 'contacts',
                    name: 'home-menu-contacts',
                    component: () => import('./components/CloudTAK/Menu/MenuContacts.vue')
                },{
                    path: 'missions',
                    name: 'home-menu-missions',
                    component: () => import('./components/CloudTAK/Menu/MenuMissions.vue')
                },{
                    path: 'missions/:mission',
                    name: 'home-menu-mission',
                    component: () => import('./components/CloudTAK/Menu/MenuMission.vue'),
                    children: [{
                        path: '',
                        name: 'home-menu-mission-default',
                        redirect: () => {
                            return { name: 'home-menu-mission-info' };
                        }
                    },{
                        path: 'info',
                        name: 'home-menu-mission-info',
                        component: () => import('./components/CloudTAK/Menu/Mission/MissionInfo.vue')
                    },{
                        path: 'users',
                        name: 'home-menu-mission-users',
                        component: () => import('./components/CloudTAK/Menu/Mission/MissionUsers.vue')
                    },{
                        path: 'layers',
                        name: 'home-menu-mission-layers',
                        component: () => import('./components/CloudTAK/Menu/Mission/MissionLayers.vue')
                    },{
                        path: 'contents',
                        name: 'home-menu-mission-contents',
                        component: () => import('./components/CloudTAK/Menu/Mission/MissionContents.vue')
                    },{
                        path: 'timeline',
                        name: 'home-menu-mission-timeline',
                        component: () => import('./components/CloudTAK/Menu/Mission/MissionTimeline.vue')
                    },{
                        path: 'logs',
                        name: 'home-menu-mission-logs',
                        component: () => import('./components/CloudTAK/Menu/Mission/MissionLogs.vue')
                    }]
                },{
                    path: 'channels',
                    name: 'home-menu-channels',
                    component: () => import('./components/CloudTAK/Menu/MenuChannels.vue')
                },{
                    path: 'routes',
                    name: 'home-menu-routes',
                    component: () => import('./components/CloudTAK/Menu/MenuRoutes.vue')
                },{
                    path: 'routes/new',
                    name: 'home-menu-routes-new',
                    component: () => import('./components/CloudTAK/Menu/MenuRoutesNew.vue')
                },{
                    path: 'chats',
                    name: 'home-menu-chats',
                    component: () => import('./components/CloudTAK/Menu/MenuChats.vue')
                },{
                    path: 'chats/:chatroom',
                    name: 'home-menu-chat',
                    component: () => import('./components/CloudTAK/Menu/MenuChat.vue')
                }]
            }]
        },

        { path: '/login', name: 'login', component: Login },

        { path: '/configure', name: 'configure', component: () => import('./components/Configure.vue') },

        { path: '/:catchAll(.*)', redirect: '/' },
    ]
});

router.onError((error, to) => {
    if (
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a module script failed')
    ) {
        if (!to?.query?.reload) {
            if (navigator.onLine) {
                window.location.href = to.fullPath;
            } else {
                console.error('Offline: Skipping reload for missing module', error);
            }
        }
    }
})

const app = createApp(App);
const pinia = createPinia()

app.use(router);
app.use(pinia);
app.use(FloatingVue);

const plugins: Record<string, {
    default: PluginStatic
}> = import.meta.glob('../plugins/*.ts', {
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
