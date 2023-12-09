import { createApp } from 'vue'
import * as VueRouter from 'vue-router'

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'

import std from './std.js';
std();

const router = new VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        { path: '/', name: 'home', component: () => import('./components/Home.vue') },

        { path: '/layer', name: 'layers', component: () => import('./components/Layers.vue') },
        { path: '/layer/new', name: 'layer-new', component: () => import('./components/LayerEdit.vue') },
        { path: '/layer/admin', name: 'layer-admin', component: () => import('./components/LayerAdmin.vue') },

        {
            path: '/layer/:layerid',
            name: 'layer',
            component: () => import('./components/Layer.vue'),
            children: [{
                path: '',
                name: 'layer-default',
                redirect: to => {
                    return { name: 'layer-deployment' };
                }
            },{
                path: 'deployment',
                name: 'layer-deployment',
                component: () => import('./components/Layer/LayerDeployment.vue')
            },{
                path: 'config',
                name: 'layer-config',
                component: () => import('./components/Layer/LayerConfig.vue')
            },{
                path: 'environment',
                name: 'layer-environment',
                component: () => import('./components/Layer/LayerEnvironment.vue')
            },{
                path: 'schema',
                name: 'layer-schema',
                component: () => import('./components/Layer/LayerSchema.vue')
            },{
                path: 'styles',
                name: 'layer-styles',
                component: () => import('./components/Layer/LayerStyles.vue')
            }]
        },


        { path: '/layer/:layerid/edit', name: 'layer-edit', component: () => import('./components/LayerEdit.vue') },
        { path: '/layer/:layerid/query', name: 'layer-query', component: () => import('./components/LayerQuery.vue') },
        { path: '/layer/:layerid/query/:featid', name: 'layer-query-feat', component: () => import('./components/LayerQueryFeature.vue') },
        { path: '/layer/:layerid/alert', name: 'layer-alerts', component: () => import('./components/LayerAlerts.vue') },

        { path: '/data', name: 'datas', component: () => import('./components/Datas.vue') },
        { path: '/data/new', name: 'data-new', component: () => import('./components/DataEdit.vue') },
        { path: '/data/:dataid', name: 'data', component: () => import('./components/Data.vue') },
        { path: '/data/:dataid/edit', name: 'data-edit', component: () => import('./components/DataEdit.vue') },
        { path: '/data/:dataid/job', name: 'data-jobs', component: () => import('./components/DataJobs.vue') },
        { path: '/data/:dataid/job/:jobid', name: 'data-job', component: () => import('./components/DataJob.vue') },

        { path: '/connection', name: 'connections', component: () => import('./components/Connections.vue') },
        { path: '/connection/new', name: 'connection-new', component: () => import('./components/ConnectionEdit.vue') },

        { path: '/connection/:connectionid/sink', name: 'connection-sinks', component: () => import('./components/ConnectionSinks.vue') },
        { path: '/connection/:connectionid/sink/new', name: 'connection-sink-new', component: () => import('./components/ConnectionSinkEdit.vue') },
        { path: '/connection/:connectionid/sink/:sinkid', name: 'connection-sink', component: () => import('./components/ConnectionSink.vue') },
        { path: '/connection/:connectionid/sink/:sinkid/edit', name: 'connection-sink-edit', component: () => import('./components/ConnectionSinkEdit.vue') },

        { path: '/connection/:connectionid', name: 'connection', component: () => import('./components/Connection.vue') },
        { path: '/connection/:connectionid/edit', name: 'connection-edit', component: () => import('./components/ConnectionEdit.vue') },

        { path: '/basemap', name: 'basemaps', component: () => import('./components/BaseMaps.vue') },
        { path: '/basemap/new', name: 'basemap-new', component: () => import('./components/BaseMapEdit.vue') },
        { path: '/basemap/:basemapid', name: 'basemap', component: () => import('./components/BaseMap.vue') },
        { path: '/basemap/:basemapid/edit', name: 'basemap-edit', component: () => import('./components/BaseMapEdit.vue') },

        {
            path: '/profile',
            name: 'profile',
            component: () => import('./components/Profile.vue'),
            children: [{
                path: '',
                name: 'profile-default',
                redirect: to => {
                    return { name: 'profile-groups' };
                }
            },{
                path: 'groups',
                name: 'layer-groups',
                component: () => import('./components/Profile/ProfileGroups.vue')
            },{
                path: 'files',
                name: 'profile-files',
                component: () => import('./components/Profile/ProfileFiles.vue')
            },{
                path: 'tokens',
                name: 'profile-tokens',
                component: () => import('./components/Profile/ProfileTokens.vue')
            }]
        },

        { path: '/iconset', name: 'icons', component: () => import('./components/Icons.vue') },
        { path: '/iconset/new', name: 'icon-new', component: () => import('./components/IconEdit.vue') },
        { path: '/iconset/:icon', name: 'icon', component: () => import('./components/Icon.vue') },
        { path: '/iconset/:icon/edit', name: 'icon-edit', component: () => import('./components/IconEdit.vue') },

        { path: '/import', name: 'imports', component: () => import('./components/Imports.vue') },
        { path: '/import/:import', name: 'import', component: () => import('./components/Import.vue') },

        { path: '/login', name: 'login', component: () => import('./components/Login.vue') },

        { path: '/admin', name: 'admin', component: () => import('./components/Admin.vue') },

        { path: '/:catchAll(.*)', name: 'lost', component: () => import('./components/Lost.vue') },
    ]
});

window.api = window.location.origin

const app = createApp(App);
app.config.devtools = true
app.use(router);
app.use(FloatingVue);
app.mount('#app');
