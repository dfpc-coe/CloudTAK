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
                    icons,
                    start_url: '/',
                    display: 'standalone',
                    background_color: '#ffffff',
                    orientation: 'any'
                },
                devOptions: {
                    enabled: true
                },
                workbox: {
                    maximumFileSizeToCacheInBytes: 3000000,
                    clientsClaim: true,
                    skipWaiting: true,
                    runtimeCaching: [
                        // Cache API responses with appropriate strategies
                        {
                            urlPattern: /^https?:\/\/.*\/api\/server$/,
                            handler: 'StaleWhileRevalidate',
                            options: {
                                cacheName: 'api-server-info',
                                expiration: {
                                    maxEntries: 1,
                                    maxAgeSeconds: 60 * 60 * 24 // 24 hours
                                }
                            }
                        },
                        {
                            urlPattern: /^https?:\/\/.*\/api\/login$/,
                            handler: 'NetworkOnly' // Never cache login attempts
                        },
                        {
                            urlPattern: /^https?:\/\/.*\/api\/config\/login$/,
                            handler: 'StaleWhileRevalidate',
                            options: {
                                cacheName: 'api-login-config',
                                expiration: {
                                    maxEntries: 5,
                                    maxAgeSeconds: 60 * 60 * 2 // 2 hours
                                }
                            }
                        },
                        {
                            urlPattern: /^https?:\/\/.*\/api\/basemap.*$/,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'api-basemaps',
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                                }
                            }
                        },
                        {
                            urlPattern: /^https?:\/\/.*\/api\/iconset.*$/,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'api-iconsets',
                                expiration: {
                                    maxEntries: 100,
                                    maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                                }
                            }
                        },
                        // Cache other API calls with network-first for better offline experience
                        {
                            urlPattern: /^https?:\/\/.*\/api\/.*$/,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'api-general',
                                expiration: {
                                    maxEntries: 200,
                                    maxAgeSeconds: 60 * 60 * 4 // 4 hours
                                },
                                networkTimeoutSeconds: 10
                            }
                        },
                        // Cache external resources (fonts, CDN assets)
                        {
                            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'google-fonts-cache',
                                expiration: {
                                    maxEntries: 10,
                                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                                }
                            }
                        },
                        {
                            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'google-fonts-webfonts',
                                expiration: {
                                    maxEntries: 30,
                                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                                }
                            }
                        }
                    ]
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
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test/setup.ts'],
            alias: {
                '@tak-ps/vue-tabler': '/src/test/__mocks__/@tak-ps/vue-tabler.ts',
            },
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

