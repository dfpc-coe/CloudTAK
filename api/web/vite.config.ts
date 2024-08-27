import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import vue from '@vitejs/plugin-vue'
import icons from './public/logos/icons.ts';

export default defineConfig((configEnv) => ({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'CloudTAK',
                short_name: 'CloudTAK',
                description: 'Cloud powered in-browser TAK Client',
                theme_color: '#000000',
                icons
            },
            devOptions: {
                enabled: true
            },
            workbox: {
                clientsClaim: true,
                skipWaiting: true
            }
        })
    ],
    optimizeDeps: {
        include: ["showdown", "@tak-ps/vue-tabler"],
    },
    server: {
        port: 8080,
    },
    build: {
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`
            }
        }
    }
}))

