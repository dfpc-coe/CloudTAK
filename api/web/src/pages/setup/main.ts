import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@tabler/core/dist/css/tabler.min.css'

import App from '../../components/Setup/App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')