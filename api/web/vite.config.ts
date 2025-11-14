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
                registerType: 'prompt',
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
                    skipWaiting: true,
                    // Clean up outdated caches automatically
                    cleanupOutdatedCaches: true,
                    // Ensure all navigation requests go through service worker
                    navigationPreload: true,
                    // Runtime caching strategy for API calls
                    runtimeCaching: [
                        {
                            urlPattern: /^https:\/\/.*\/api\/.*/i,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'api-cache',
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 60 * 60 // 1 hour
                                },
                                networkTimeoutSeconds: 10
                            }
                        }
                    ]
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
            deps: {
                inline: ['@tak-ps/vue-tabler']
            },
            setupFiles: ['./src/test/setup.ts'],
        },
    }

    return res;
})

