import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path';
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
                    icons,
                    orientation: 'landscape',
                    categories: ['utilities', 'productivity', 'navigation', 'government']
                },
                devOptions: {
                    enabled: true
                },
                workbox: {
                    maximumFileSizeToCacheInBytes: 3000000,
                    clientsClaim: true,
                    skipWaiting: true
                }
            })
        ],
        optimizeDeps: {
            include: ["showdown", "@tak-ps/vue-tabler"],
        },
        build: {
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'index.html'),
                    docs: path.resolve(__dirname, 'docs.html'),
                    video: path.resolve(__dirname, 'video.html'),
                },
                output: {
                    entryFileNames: `assets/[name].js`,
                    chunkFileNames: `assets/[name].js`,
                    assetFileNames: `assets/[name].[ext]`
                }
            },
        },
        server: {
            port: 8080,
        },
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test/setup.ts'],
            alias: {
                '@tak-ps/vue-tabler': '/src/test/__mocks__/@tak-ps/vue-tabler.ts',
            },
        },
    }

    return res;
})

