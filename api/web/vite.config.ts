import { defineConfig, type ResolvedConfig, type Plugin, type ViteDevServer } from 'vite'
import fs from 'node:fs';
import path from 'node:path';
import vue from '@vitejs/plugin-vue'
import type { IncomingMessage, ServerResponse } from 'node:http';

const milsymbolBrowserBundle = path.resolve(__dirname, 'node_modules/milsymbol/dist/milsymbol.js');

/**
 * Vite compiles `?worker&url` bundles (Atlas + MapLibre workers) and their
 * chunks in a separate build it never records in `manifest.json`, so the
 * service worker's manifest-driven precache misses them and `new Worker(...)`
 * 404s after a deploy. This injects those leftover chunks back into the
 * manifest as synthetic `worker:` entries, so the SW's normal walk precaches them.
 */
function precacheWorkerAssetsPlugin(): Plugin {
    let outDir = 'dist';

    return {
        name: 'cloudtak-precache-worker-assets',
        apply: 'build',
        configResolved(config: ResolvedConfig) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            const manifestPath = path.join(outDir, '.vite', 'manifest.json');
            const assetsDir = path.join(outDir, 'assets');

            if (!fs.existsSync(manifestPath) || !fs.existsSync(assetsDir)) return;

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, {
                file?: string;
                name?: string;
                src?: string;
                css?: string[];
                assets?: string[];
            }>;

            const referenced = new Set<string>();
            for (const entry of Object.values(manifest)) {
                if (entry.file) referenced.add(entry.file);
                for (const file of entry.css ?? []) referenced.add(file);
                for (const file of entry.assets ?? []) referenced.add(file);
            }

            const workerAssets = fs.readdirSync(assetsDir)
                .map((name) => `assets/${name}`)
                .filter((rel) => (rel.endsWith('.js') || rel.endsWith('.css')) && !referenced.has(rel))
                .sort();

            for (const file of workerAssets) {
                // Namespaced key so these never collide with real Vite entries.
                manifest[`worker:${file}`] = { file, src: `worker:${file}` };
            }

            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

            console.log(`[vite] Injected ${workerAssets.length} worker asset(s) into the manifest for service-worker precache`);
        },
    };
}

export default defineConfig(({ mode }) => {
    return {
        define: {
            'import.meta.env.HASH': JSON.stringify(Math.random().toString(36).substring(2, 15)),
        },
        plugins: [
            vue(),
            precacheWorkerAssetsPlugin(),
            {
                name: 'configure-server',
                configureServer(server: ViteDevServer) {
                    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => {
                        if (req.url?.startsWith('/admin') && !path.extname(req.url)) {
                            req.url = '/admin.html';
                        } else if (req.url?.startsWith('/connection') && !path.extname(req.url)) {
                            req.url = '/connection.html';
                        } else if (req.url?.startsWith('/setup') && !path.extname(req.url)) {
                            req.url = '/setup.html';
                        }
                        next();
                    });
                }
            }
        ],
        optimizeDeps: {
            include: ["showdown", "@tak-ps/vue-tabler"],
        },
        resolve: {
            alias: {
                'milsymbol': milsymbolBrowserBundle,
                '@tak-ps/cloudtak': path.resolve(__dirname, './plugin.ts'),
                '@': path.resolve(__dirname, './src'),
                '@cloudtak/api-types': path.resolve(__dirname, '../derived-types.d.ts'),
            }
        },
        build: {
            manifest: true,
            target: 'esnext',
            rolldownOptions: {
                input: {
                    main: path.resolve(__dirname, 'index.html'),
                    docs: path.resolve(__dirname, 'docs.html'),
                    video: path.resolve(__dirname, 'video.html'),
                    admin: path.resolve(__dirname, 'admin.html'),
                    connection: path.resolve(__dirname, 'connection.html'),
                    setup: path.resolve(__dirname, 'setup.html'),
                },
            },
        },
        worker: {
            format: 'es'
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
    };
})

