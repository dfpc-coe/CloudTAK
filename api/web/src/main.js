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
        { path: '/layer/:layerid', name: 'layer', component: () => import('./components/Layer.vue') },
        { path: '/layer/:layerid/edit', name: 'layer-edit', component: () => import('./components/LayerEdit.vue') },
        { path: '/layer/:layerid/query', name: 'layer-query', component: () => import('./components/LayerQuery.vue') },

        { path: '/connection', name: 'connections', component: () => import('./components/Connections.vue') },
        { path: '/connection/new', name: 'connection-new', component: () => import('./components/ConnectionEdit.vue') },
        { path: '/connection/:connectionid', name: 'connection', component: () => import('./components/Connection.vue') },
        { path: '/connection/:connectionid/edit', name: 'connection-edit', component: () => import('./components/ConnectionEdit.vue') },

        { path: '/icon', name: 'icons', component: () => import('./components/Icons.vue') },

        { path: '/login', name: 'login', component: () => import('./components/Login.vue') },

        { path: '/admin', name: 'admin', component: () => import('./components/Admin.vue') },
    ]
});

window.api = window.location.origin

const app = createApp(App);
app.config.devtools = true
app.use(router);
app.use(FloatingVue);
app.mount('#app');
