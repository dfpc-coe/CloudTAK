import { createApp } from 'vue'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { initGlobalErrorReporting, vueErrorHandler } from '../../lib/reporting/index.ts';

import '@tabler/core/dist/css/tabler.min.css'

import App from '../../components/Setup/App.vue'

initGlobalErrorReporting();

// Capgo rolls back the bundle on next launch if this is never called.
if (Capacitor.isNativePlatform()) {
    void CapacitorUpdater.notifyAppReady()
}

const app = createApp(App)
app.config.errorHandler = vueErrorHandler;
app.mount('#app')
