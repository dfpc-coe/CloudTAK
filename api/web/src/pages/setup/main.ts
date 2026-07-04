import { createApp } from 'vue'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { initGlobalErrorReporting, vueErrorHandler } from '../../lib/reporting/index.ts';

import '@tabler/core/dist/css/tabler.min.css'

import App from '../../components/Setup/App.vue'

initGlobalErrorReporting();

// Without this the Capgo updater assumes the bundle failed to boot and rolls
// it back on the next launch, stranding users on stale setup code.
if (Capacitor.isNativePlatform()) {
    void CapacitorUpdater.notifyAppReady()
}

const app = createApp(App)
app.config.errorHandler = vueErrorHandler;
app.mount('#app')