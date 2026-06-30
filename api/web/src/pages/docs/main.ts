import { createApp } from 'vue'
import { version } from '../../../package.json'
import { initServiceWorker } from '../../base/service-worker.ts';
import { initGlobalErrorReporting, vueErrorHandler } from '../../lib/reporting/index.ts';

import App from './App.vue';

initServiceWorker(version);
initGlobalErrorReporting();

const app = createApp(App);
app.config.errorHandler = vueErrorHandler;
app.mount('#app');
