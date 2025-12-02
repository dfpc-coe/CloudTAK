import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import { createPinia } from 'pinia'

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from '../../App.vue'

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        { path: '/connection/:connectionid/layer/new', name: 'connection-layer-new', component: () => import('../../components/ETL/LayerEdit.vue') },
        { path: '/connection/:connectionid/data/:dataid/layer/new', name: 'connection-data-layer-new', component: () => import('../../components/ETL/LayerEdit.vue') },

        {
            path: '/connection/:connectionid/layer/:layerid',
            name: 'layer',
            component: () => import('../../components/ETL/Layer.vue'),
            children: [{
                path: '',
                name: `layer-default`,
                redirect: () => {
                    return { name: `layer-deployment` };
                }
            },{
                path: 'deployment',
                name: `layer-deployment`,
                component: () => import('../../components/ETL/Layer/LayerDeployment.vue')
            },{
                path: 'alarm',
                name: `layer-alarm`,
                component: () => import('../../components/ETL/Layer/LayerAlarm.vue')
            },{
                path: 'incoming/config',
                name: `layer-incoming-config`,
                component: () => import('../../components/ETL/Layer/LayerIncomingConfig.vue')
            },{
                path: 'incoming/environment',
                name: `layer-incoming-environment`,
                component: () => import('../../components/ETL/Layer/LayerEnvironment.vue')
            },{
                path: 'incoming/schema',
                name: `layer-incoming-schema`,
                component: () => import('../../components/ETL/Layer/LayerIncomingSchema.vue')
            },{
                path: 'incoming/styles',
                name: `layer-incoming-styles`,
                component: () => import('../../components/ETL/Layer/LayerIncomingStyles.vue')
            },{
                path: 'outgoing/environment',
                name: `layer-outgoing-environment`,
                component: () => import('../../components/ETL/Layer/LayerEnvironment.vue')
            },{
                path: 'outgoing/config',
                name: `layer-outgoing-config`,
                component: () => import('../../components/ETL/Layer/LayerOutgoingConfig.vue')
            }]
        },

        { path: '/connection/:connectionid/layer/:layerid/edit', name: 'layer-edit', component: () => import('../../components/ETL/LayerEdit.vue') },

        { path: '/connection/:connectionid/data/new', name: 'data-new', component: () => import('../../components/ETL/DataEdit.vue') },
        {
            path: '/connection/:connectionid/data/:dataid',
            name: 'data',
            component: () => import('../../components/ETL/Data.vue'),
            children: [{
                path: '',
                name: 'data-default',
                redirect: () => {
                    return { name: 'data-files' };
                }
            },{
                path: 'groups',
                name: 'data-groups',
                component: () => import('../../components/ETL/Data/DataGroups.vue')
            },{
                path: 'files',
                name: 'data-files',
                component: () => import('../../components/ETL/Data/DataFiles.vue')
            },{
                path: 'layer',
                name: 'data-layer',
                component: () => import('../../components/ETL/Data/DataLayer.vue')
            }]
        },
        { path: '/connection/:connectionid/data/:dataid/edit', name: 'data-edit', component: () => import('../../components/ETL/DataEdit.vue') },

        { path: '/connection', name: 'connections', component: () => import('../../components/ETL/Connections.vue') },
        { path: '/connection/new', name: 'connection-new', component: () => import('../../components/ETL/ConnectionEdit.vue') },

        {
            path: '/connection/:connectionid',
            name: 'connection',
            component: () => import('../../components/ETL/Connection.vue'),
            children: [{
                path: '',
                name: 'connection-default',
                redirect: () => {
                    return { name: 'connection-layers' };
                }
            },{
                path: 'groups',
                name: 'connection-groups',
                component: () => import('../../components/ETL/Connection/ConnectionGroups.vue')
            },{
                path: 'layer',
                name: 'connection-layers',
                component: () => import('../../components/ETL/Connection/ConnectionLayer.vue')
            },{
                path: 'files',
                name: 'connection-files',
                component: () => import('../../components/ETL/Connection/ConnectionFiles.vue')
            },{
                path: 'data',
                name: 'connection-datas',
                component: () => import('../../components/ETL/Connection/ConnectionData.vue')
            },{
                path: 'video',
                name: 'connection-videos',
                component: () => import('../../components/ETL/Connection/ConnectionVideos.vue')
            },{
                path: 'tokens',
                name: 'connection-tokens',
                component: () => import('../../components/ETL/Connection/ConnectionTokens.vue')
            }]
        },

        { path: '/connection/:connectionid/edit', name: 'connection-edit', component: () => import('../../components/ETL/ConnectionEdit.vue') },

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
