import { createApp } from 'vue'
import { createHead } from '@unhead/vue/client';
import { initServiceWorker } from '../../utils/service-worker.ts';
import { initGlobalErrorReporting, vueErrorHandler } from '../../lib/reporting/index.ts';

import App from './App.vue';

initServiceWorker();
initGlobalErrorReporting();

const app = createApp(App);
app.config.errorHandler = vueErrorHandler;
app.use(createHead());
app.mount('#app');
