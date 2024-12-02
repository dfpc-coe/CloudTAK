import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import vue from '@vitejs/plugin-vue'
import icons from './public/logos/icons.ts';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    const res = {
        define: {
            'process.env.API_URL': env.API_URL
        },
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
        build: {},
        server: {
            port: 8080,
        },
    }

    if (process.env.VITE_MODE !== 's3') {
        res.build = {
            rollupOptions: {
                output: {
                    entryFileNames: `assets/[name].js`,
                    chunkFileNames: `assets/[name].js`,
                    assetFileNames: `assets/[name].[ext]`
                }
            }
        }
    }

    return res;
})

