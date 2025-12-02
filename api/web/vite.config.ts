import { defineConfig, type ViteDevServer } from 'vite'
import path from 'node:path';
import vue from '@vitejs/plugin-vue'
import icons from './public/logos/icons.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default defineConfig(({ mode }) => {
    const res = {
        define: {
            'import.meta.env.HASH': JSON.stringify(Math.random().toString(36).substring(2, 15)),
        },
        plugins: [
            vue(),
            {
                name: 'configure-server',
                configureServer(server: ViteDevServer) {
                    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => {
                        if (req.url?.startsWith('/admin') && !path.extname(req.url)) {
                            req.url = '/admin.html';
                        } else if (req.url?.startsWith('/connection') && !path.extname(req.url)) {
                            req.url = '/connection.html';
                        }
                        next();
                    });
                }
            }
        ],
        optimizeDeps: {
            include: ["showdown", "@tak-ps/vue-tabler"],
        },
        build: {
            manifest: true,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'index.html'),
                    docs: path.resolve(__dirname, 'docs.html'),
                    video: path.resolve(__dirname, 'video.html'),
                    admin: path.resolve(__dirname, 'admin.html'),
                    connection: path.resolve(__dirname, 'connection.html'),
                },
            },
        },
        server: {
            port: 8080,
            proxy: {
                '/api': {
                    ws: true,
                    target: 'http://localhost:5001',
                    changeOrigin: true,
                }
            }
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

