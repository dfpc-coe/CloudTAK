import { createApp } from 'vue'
import * as VueRouter from 'vue-router'
import { createPinia } from 'pinia'

import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'

import App from '../../App.vue'

const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        {
            path: '/video',
            name: 'home',
            component: () => import('../../components/VideoWall.vue'),
            children: []
        }
    ]
});

const app = createApp(App);
const pinia = createPinia()
app.use(router);
app.use(pinia);
app.use(FloatingVue);
app.mount('#app');
