import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import vue from '@vitejs/plugin-vue'

export default defineConfig((configEnv) => ({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'CloudTAK',
                short_name: 'CloudTAK',
                description: 'Cloud powered in-browser TAK Client',
                theme_color: '#ffffff',
                icons: [{
                    src: './oublic/logo.png',
                    sizes: '1000x1062',
                    type: 'image/png'
                }]
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

