import { createApp } from 'vue'
import { version } from '../../../package.json'
import * as VueRouter from 'vue-router'
import { createPinia } from 'pinia'

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

import App from '../../App.vue'

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        {
            path: '/admin',
            name: 'admin',
            component: () => import('../../components/ServerAdmin.vue'),
            children: [{
                path: '',
                name: 'admin-default',
                redirect: () => {
                    return { name: 'admin-server-connection' };
                }
            },{
                path: 'layer',
                name: 'admin-layers',
                component: () => import('../../components/Admin/AdminLayers.vue')
            },{
                path: 'layer/new',
                name: 'admin-layer-new',
                component: () => import('../../components/Admin/AdminLayerTemplate.vue')
            },{
                path: 'video',
                name: 'admin-videos',
                component: () => import('../../components/Admin/AdminVideos.vue'),
                children: [{
                    path: '',
                    name: 'admin-video-default',
                    redirect: () => {
                        return { name: 'admin-video-service' };
                    }
                },{
                    path: 'service',
                    name: 'admin-video-service',
                    component: () => import('../../components/Admin/Videos/AdminVideoService.vue')
                },{
                    path: 'leases',
                    name: 'admin-video-leases',
                    component: () => import('../../components/Admin/Videos/AdminVideoLeases.vue')
                }]
            },{
                path: 'overlay',
                name: 'admin-overlays',
                component: () => import('../../components/Admin/AdminOverlays.vue')
            },{
                path: 'overlay/:overlay',
                name: 'admin-overlays-edit',
                component: () => import('../../components/Admin/AdminOverlaysEdit.vue')
            },{
                path: 'data',
                name: 'admin-data',
                component: () => import('../../components/Admin/AdminDatas.vue')
            },{
                path: 'connection',
                name: 'admin-connection',
                component: () => import('../../components/Admin/AdminConnections.vue')
            },{
                path: 'user',
                name: 'admin-users',
                component: () => import('../../components/Admin/AdminUsers.vue')
            },{
                path: 'user/:user',
                name: 'admin-user',
                component: () => import('../../components/Admin/AdminUser.vue')
            },{
                path: 'import',
                name: 'admin-imports',
                component: () => import('../../components/Admin/AdminImports.vue')
            },{
                path: 'templates',
                name: 'admin-mission-templates',
                component: () => import('../../components/Admin/AdminMissionTemplates.vue')
            },{
                path: 'template/:template',
                name: 'admin-mission-template',
                component: () => import('../../components/Admin/AdminMissionTemplate.vue')
            },{
                path: 'template/:template/log/:log',
                name: 'admin-mission-template-log',
                component: () => import('../../components/Admin/AdminMissionTemplateLog.vue')
            },{
                path: 'palette',
                name: 'admin-palettes',
                component: () => import('../../components/Admin/AdminPalettes.vue')
            },{
                path: 'palette/:palette',
                name: 'admin-palette',
                component: () => import('../../components/Admin/AdminPalette.vue')
            },{
                path: 'palette/:palette/feature/:feature',
                name: 'admin-palette-feature',
                component: () => import('../../components/Admin/AdminPaletteFeature.vue')
            },{
                path: 'tasks',
                name: 'admin-tasks',
                component: () => import('../../components/Admin/AdminTasks.vue'),
                children: [{
                    path: '',
                    name: 'admin-tasks-default',
                    redirect: () => {
                        return { name: 'admin-tasks-registered' };
                    }
                },{
                    path: 'registered',
                    name: 'admin-tasks-registered',
                    component: () => import('../../components/Admin/Tasks/AdminTasks.vue')
                },{
                    path: 'raw',
                    name: 'admin-tasks-raw',
                    component: () => import('../../components/Admin/Tasks/AdminRawTasks.vue')
                }]
            },{
                path: 'server',
                name: 'admin-server',
                component: () => import('../../components/Admin/AdminServer.vue'),
                children: [{
                    path: '',
                    name: 'admin-server-default',
                    redirect: () => {
                        return { name: 'admin-server-connection' };
                    }
                },{
                    path: 'connection',
                    name: 'admin-server-connection',
                    component: () => import('../../components/Admin/Server/ServerConnection.vue')
                },{
                    path: 'injector',
                    name: 'admin-server-injector',
                    component: () => import('../../components/Admin/Server/ServerInjectors.vue')
                },{
                    path: 'repeater',
                    name: 'admin-server-repeater',
                    component: () => import('../../components/Admin/Server/ServerRepeaters.vue')
                },{
                    path: 'packages',
                    name: 'admin-server-packages',
                    component: () => import('../../components/Admin/Server/ServerPackages.vue')
                },{
                    path: 'videos',
                    name: 'admin-server-videos',
                    component: () => import('../../components/Admin/Server/ServerVideos.vue')
                }]
            },{
                path: 'config',
                name: 'admin-config',
                component: () => import('../../components/Admin/AdminConfig.vue')
            },{
                path: 'export',
                name: 'admin-export',
                component: () => import('../../components/Admin/AdminExport.vue')
            }]
        },
        { path: '/:catchAll(.*)', name: 'lost', component: () => import('../../components/LostUser.vue') },
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

app.mount('#app');
