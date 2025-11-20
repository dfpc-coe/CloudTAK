import { defineConfig } from 'vite'
import path from 'node:path';
import vue from '@vitejs/plugin-vue'
import icons from './public/logos/icons.ts';

export default defineConfig(({ mode }) => {
    const res = {
        plugins: [
            vue()
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

