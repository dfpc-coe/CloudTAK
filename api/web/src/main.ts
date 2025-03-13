import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import { createPinia } from 'pinia'

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from './App.vue'

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
                    component: () => import('./components/CloudTAK/Menu/Settings.vue')
                },{
                    path: 'settings/tokens',
                    name: 'home-menu-settings-tokens',
                    component: () => import('./components/CloudTAK/Menu/SettingsTokens.vue')
                },{
                    path: 'settings/callsign',
                    name: 'home-menu-settings-callsign',
                    component: () => import('./components/CloudTAK/Menu/SettingsCallsign.vue')
                },{
                    path: 'settings/display',
                    name: 'home-menu-settings-display',
                    component: () => import('./components/CloudTAK/Menu/SettingsDisplay.vue')
                },{
                    path: 'imports',
                    name: 'home-menu-imports',
                    component: () => import('./components/CloudTAK/Menu/Imports.vue')
                },{
                    path: 'files',
                    name: 'home-menu-files',
                    component: () => import('./components/CloudTAK/Menu/Files.vue')
                },{
                    path: 'packages',
                    name: 'home-menu-packages',
                    component: () => import('./components/CloudTAK/Menu/Packages.vue')
                },{
                    path: 'connections',
                    name: 'home-menu-connections',
                    component: () => import('./components/CloudTAK/Menu/Connections.vue')
                },{
                    path: 'videos',
                    name: 'home-menu-videos',
                    component: () => import('./components/CloudTAK/Menu/Videos.vue')
                },{
                    path: 'videos/remote/:connectionid',
                    name: 'home-menu-videos-remote-new',
                    component: () => import('./components/CloudTAK/Menu/VideosRemote.vue')
                },{
                    path: 'debugger',
                    name: 'home-menu-debugger',
                    component: () => import('./components/CloudTAK/Menu/Debugger.vue')
                },{
                    path: 'packages/:package',
                    name: 'home-menu-package',
                    component: () => import('./components/CloudTAK/Menu/Package.vue')
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
                    path: 'overlays',
                    name: 'home-menu-overlays',
                    component: () => import('./components/CloudTAK/Menu/Overlays.vue')
                },{
                    path: 'datas',
                    name: 'home-menu-datas',
                    component: () => import('./components/CloudTAK/Menu/OverlayExplorer.vue')
                },{
                    path: 'contacts',
                    name: 'home-menu-contacts',
                    component: () => import('./components/CloudTAK/Menu/Contacts.vue')
                },{
                    path: 'missions',
                    name: 'home-menu-missions',
                    component: () => import('./components/CloudTAK/Menu/Missions.vue')
                },{
                    path: 'missions/:mission',
                    name: 'home-menu-mission',
                    component: () => import('./components/CloudTAK/Menu/Mission.vue'),
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
                    component: () => import('./components/CloudTAK/Menu/Channels.vue')
                },{
                    path: 'chats',
                    name: 'home-menu-chats',
                    component: () => import('./components/CloudTAK/Menu/Chats.vue')
                },{
                    path: 'chats/:chatroom',
                    name: 'home-menu-chat',
                    component: () => import('./components/CloudTAK/Menu/Chat.vue')
                }]
            }]
        },

        { path: '/connection/:connectionid/layer/new', name: 'connection-layer-new', component: () => import('./components/LayerEdit.vue') },
        { path: '/connection/:connectionid/data/:dataid/layer/new', name: 'connection-data-layer-new', component: () => import('./components/LayerEdit.vue') },

        {
            path: '/connection/:connectionid/layer/:layerid',
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
                path: 'incoming/config',
                name: 'layer-incoming-config',
                component: () => import('./components/Layer/LayerIncomingConfig.vue')
            },{
                path: 'incoming/environment',
                name: 'layer-incoming-environment',
                component: () => import('./components/Layer/LayerEnvironment.vue')
            },{
                path: 'incoming/schema',
                name: 'layer-incoming-schema',
                component: () => import('./components/Layer/LayerIncomingSchema.vue')
            },{
                path: 'incoming/styles',
                name: 'layer-incoming-styles',
                component: () => import('./components/Layer/LayerIncomingStyles.vue')
            },{
                path: 'outgoing/environment',
                name: 'layer-outgoing-environment',
                component: () => import('./components/Layer/LayerEnvironment.vue')
            }]
        },


        { path: '/connection/:connectionid/layer/:layerid/edit', name: 'layer-edit', component: () => import('./components/LayerEdit.vue') },
        { path: '/connection/:connectionid/layer/:layerid/alert', name: 'layer-alerts', component: () => import('./components/LayerAlerts.vue') },

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
                    return { name: 'connection-layers' };
                }
            },{
                path: 'groups',
                name: 'connection-groups',
                component: () => import('./components/Connection/ConnectionGroups.vue')
            },{
                path: 'layer',
                name: 'connection-layers',
                component: () => import('./components/Connection/ConnectionLayer.vue')
            },{
                path: 'files',
                name: 'connection-files',
                component: () => import('./components/Connection/ConnectionFiles.vue')
            },{
                path: 'data',
                name: 'connection-datas',
                component: () => import('./components/Connection/ConnectionData.vue')
            },{
                path: 'sink',
                name: 'connection-sinks',
                component: () => import('./components/Connection/ConnectionSink.vue')
            },{
                path: 'tokens',
                name: 'connection-tokens',
                component: () => import('./components/Connection/ConnectionTokens.vue')
            }]
        },

        { path: '/connection/:connectionid/edit', name: 'connection-edit', component: () => import('./components/ConnectionEdit.vue') },

        { path: '/login', name: 'login', component: () => import('./components/Login.vue') },

        { path: '/configure', name: 'configure', component: () => import('./components/Configure.vue') },

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
                path: 'video',
                name: 'admin-videos',
                component: () => import('./components/Admin/AdminVideos.vue'),
                children: [{
                    path: '',
                    name: 'admin-video-default',
                    redirect: () => {
                        return { name: 'admin-video-service' };
                    }
                },{
                    path: 'service',
                    name: 'admin-video-service',
                    component: () => import('./components/Admin/Videos/AdminVideoService.vue')
                },{
                    path: 'leases',
                    name: 'admin-video-leases',
                    component: () => import('./components/Admin/Videos/AdminVideoLeases.vue')
                },{
                    path: 'tasks',
                    name: 'admin-video-tasks',
                    component: () => import('./components/Admin/Videos/AdminVideoTasks.vue')
                },{
                    path: 'tasks/:task',
                    name: 'admin-video',
                    component: () => import('./components/Admin/Videos/AdminVideoTask.vue')
                }]
            },{
                path: 'overlay',
                name: 'admin-overlays',
                component: () => import('./components/Admin/AdminOverlays.vue')
            },{
                path: 'overlay/:overlay',
                name: 'admin-overlays-edit',
                component: () => import('./components/Admin/AdminOverlaysEdit.vue')
            },{
                path: 'data',
                name: 'admin-data',
                component: () => import('./components/Admin/AdminDatas.vue')
            },{
                path: 'connection',
                name: 'admin-connection',
                component: () => import('./components/Admin/AdminConnections.vue')
            },{
                path: 'user',
                name: 'admin-users',
                component: () => import('./components/Admin/AdminUsers.vue')
            },{
                path: 'user/:user',
                name: 'admin-user',
                component: () => import('./components/Admin/AdminUser.vue')
            },{
                path: 'tasks',
                name: 'admin-tasks',
                component: () => import('./components/Admin/AdminTasks.vue'),
                children: [{
                    path: '',
                    name: 'admin-tasks-default',
                    redirect: () => {
                        return { name: 'admin-tasks-registered' };
                    }
                },{
                    path: 'registered',
                    name: 'admin-tasks-registered',
                    component: () => import('./components/Admin/Tasks/AdminTasks.vue')
                },{
                    path: 'raw',
                    name: 'admin-tasks-raw',
                    component: () => import('./components/Admin/Tasks/AdminRawTasks.vue')
                }]
            },{
                path: 'server',
                name: 'admin-server',
                component: () => import('./components/Admin/AdminServer.vue')
            },{
                path: 'config',
                name: 'admin-config',
                component: () => import('./components/Admin/AdminConfig.vue')
            },{
                path: 'export',
                name: 'admin-export',
                component: () => import('./components/Admin/AdminExport.vue')
            },{
                path: 'template',
                name: 'admin-templates',
                component: () => import('./components/Admin/AdminTemplates.vue')
            },{
                path: 'template/:template',
                name: 'admin-template',
                component: () => import('./components/Admin/AdminTemplate.vue')
            }]
        },

        { path: '/:catchAll(.*)', name: 'lost', component: () => import('./components/Lost.vue') },
    ]
});

const app = createApp(App);
const pinia = createPinia()
app.use(router);
app.use(pinia);
app.use(FloatingVue);
app.mount('#app');
