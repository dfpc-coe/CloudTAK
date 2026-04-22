import { createApp } from 'vue'
import { version } from '../../../package.json'
import { initServiceWorker } from '../../base/service-worker.ts';

import App from './App.vue'

initServiceWorker(version);

const app = createApp(App);
app.mount('#app');
