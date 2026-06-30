import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initGlobalErrorReporting, vueErrorHandler } from '../../lib/reporting/index.ts';

import '@tabler/core/dist/css/tabler.min.css'

import App from '../../components/Setup/App.vue'

initGlobalErrorReporting();

const app = createApp(App)
app.config.errorHandler = vueErrorHandler;
app.use(createPinia())
app.mount('#app')