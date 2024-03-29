import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import { createPinia } from 'pinia'

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'

const router = new VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('./components/Home.vue'),
            children: [{
                path: 'menu',
                name: 'home-menu',
                component: () => import('./components/CloudTAK/Menu.vue'),
                children: [{
                    path: 'settings',
                    name: 'home-menu-settings',
                    component: () => import('./components/CloudTAK/Menu/Settings.vue')
                },{
                    path: 'imports',
                    name: 'home-menu-imports',
                    component: () => import('./components/CloudTAK/Menu/Imports.vue')
                },{
                    path: 'imports/:import',
                    name: 'home-menu-import',
                    component: () => import('./components/CloudTAK/Menu/Import.vue')
                },{
                    path: 'basemaps',
                    name: 'home-menu-basemaps',
                    component: () => import('./components/CloudTAK/Menu/Basemaps.vue')
                },{
                    path: 'iconsets',
                    name: 'home-menu-iconsets',
                    component: () => import('./components/CloudTAK/Menu/Iconsets.vue')
                },{
                    path: 'iconset/:iconset',
                    name: 'home-menu-iconset',
                    component: () => import('./components/CloudTAK/Menu/Iconset.vue')
                },{
                    path: 'iconset/:iconset/:icon',
                    name: 'home-menu-iconset-icon',
                    component: () => import('./components/CloudTAK/Menu/Icon.vue')
                },{
                    path: 'iconset/:iconset/:icon/edit',
                    name: 'home-menu-iconset-icon-edit',
                    component: () => import('./components/CloudTAK/Menu/IconEdit.vue')
                },{
                    path: 'overlays',
                    name: 'home-menu-overlays',
                    component: () => import('./components/CloudTAK/Menu/Overlays.vue')
                },{
                    path: 'datas',
                    name: 'home-menu-datas',
                    component: () => import('./components/CloudTAK/Menu/Datas.vue')
                },{
                    path: 'contacts',
                    name: 'home-menu-contacts',
                    component: () => import('./components/CloudTAK/Menu/Contacts.vue')
                },{
                    path: 'missions',
                    name: 'home-menu-missions',
                    component: () => import('./components/CloudTAK/Menu/Missions.vue')
                },{
                    path: 'channels',
                    name: 'home-menu-channels',
                    component: () => import('./components/CloudTAK/Menu/Channels.vue')
                },{
                    path: 'chats',
                    name: 'home-menu-chats',
                    component: () => import('./components/CloudTAK/Menu/Chats.vue')
                },{
                    path: 'chats/:uid',
                    name: 'home-menu-chat',
                    component: () => import('./components/CloudTAK/Menu/Chat.vue')
                }]
            }]
        },

        { path: '/layer', name: 'layers', component: () => import('./components/Layers.vue') },
        { path: '/layer/new', name: 'layer-new', component: () => import('./components/LayerEdit.vue') },

        {
            path: '/layer/:layerid',
            name: 'layer',
            component: () => import('./components/Layer.vue'),
            children: [{
                path: '',
                name: 'layer-default',
                redirect: () => {
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

        { path: '/connection/:connectionid/data/new', name: 'data-new', component: () => import('./components/DataEdit.vue') },
        {
            path: '/connection/:connectionid/data/:dataid',
            name: 'data',
            component: () => import('./components/Data.vue'),
            children: [{
                path: '',
                name: 'data-default',
                redirect: () => {
                    return { name: 'data-files' };
                }
            },{
                path: 'groups',
                name: 'data-groups',
                component: () => import('./components/Data/DataGroups.vue')
            },{
                path: 'files',
                name: 'data-files',
                component: () => import('./components/Data/DataFiles.vue')
            },{
                path: 'layer',
                name: 'data-layer',
                component: () => import('./components/Data/DataLayer.vue')
            },{
                path: 'jobs',
                name: 'data-jobs',
                component: () => import('./components/Data/DataJobs.vue')
            }]
        },
        { path: '/connection/:connectionid/data/:dataid/edit', name: 'data-edit', component: () => import('./components/DataEdit.vue') },
        { path: '/connection/:connectionid/data/:dataid/job/:jobid', name: 'data-job', component: () => import('./components/DataJob.vue') },

        { path: '/connection', name: 'connections', component: () => import('./components/Connections.vue') },
        { path: '/connection/new', name: 'connection-new', component: () => import('./components/ConnectionEdit.vue') },

        { path: '/connection/:connectionid/sink/new', name: 'connection-sink-new', component: () => import('./components/ConnectionSinkEdit.vue') },
        { path: '/connection/:connectionid/sink/:sinkid', name: 'connection-sink', component: () => import('./components/ConnectionSink.vue') },
        { path: '/connection/:connectionid/sink/:sinkid/edit', name: 'connection-sink-edit', component: () => import('./components/ConnectionSinkEdit.vue') },

        {
            path: '/connection/:connectionid',
            name: 'connection',
            component: () => import('./components/Connection.vue'),
            children: [{
                path: '',
                name: 'connection-default',
                redirect: () => {
                    return { name: 'connection-layer' };
                }
            },{
                path: 'groups',
                name: 'connection-groups',
                component: () => import('./components/Connection/ConnectionGroups.vue')
            },{
                path: 'layer',
                name: 'connection-layer',
                component: () => import('./components/Connection/ConnectionLayer.vue')
            },{
                path: 'data',
                name: 'connection-data',
                component: () => import('./components/Connection/ConnectionData.vue')
            },{
                path: 'sink',
                name: 'connection-sink',
                component: () => import('./components/Connection/ConnectionSink.vue')
            },{
                path: 'health',
                name: 'connection-health',
                component: () => import('./components/Connection/ConnectionHealth.vue')
            },{
                path: 'tokens',
                name: 'connection-tokens',
                component: () => import('./components/Connection/ConnectionTokens.vue')
            }]
        },

        { path: '/connection/:connectionid/edit', name: 'connection-edit', component: () => import('./components/ConnectionEdit.vue') },

        {
            path: '/profile',
            name: 'profile',
            component: () => import('./components/Profile.vue'),
            children: [{
                path: '',
                name: 'profile-default',
                redirect: () => {
                    return { name: 'profile-groups' };
                }
            },{
                path: 'groups',
                name: 'profile-groups',
                component: () => import('./components/Profile/ProfileGroups.vue')
            },{
                path: 'jobs',
                name: 'profile-jobs',
                component: () => import('./components/Profile/ProfileJobs.vue')
            },{
                path: 'job/:jobid',
                name: 'profile-job',
                component: () => import('./components/Profile/ProfileJob.vue')
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

        { path: '/login', name: 'login', component: () => import('./components/Login.vue') },

        {
            path: '/admin',
            name: 'admin',
            component: () => import('./components/Admin.vue'),
            children: [{
                path: '',
                name: 'admin-default',
                redirect: () => {
                    return { name: 'admin-server' };
                }
            },{
                path: 'layer',
                name: 'admin-layer',
                component: () => import('./components/Admin/AdminLayers.vue')
            },{
                path: 'user',
                name: 'admin-user',
                component: () => import('./components/Admin/AdminUsers.vue')
            },{
                path: 'task',
                name: 'admin-task',
                component: () => import('./components/Admin/AdminTasks.vue')
            },{
                path: 'server',
                name: 'admin-server',
                component: () => import('./components/Admin/AdminServer.vue')
            }]
        },

        { path: '/:catchAll(.*)', name: 'lost', component: () => import('./components/Lost.vue') },
    ]
});

window.api = window.location.origin

const app = createApp(App);
const pinia = createPinia()
app.config.devtools = true
app.use(router);
app.use(pinia);
app.use(FloatingVue);
app.mount('#app');
