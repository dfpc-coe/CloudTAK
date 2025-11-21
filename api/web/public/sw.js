const params = new URL(location).searchParams;
const VERSION = params.get('v') || Math.random().toString(36).substring(2, 8);
const BUILD  = params.get('build') || Math.random().toString(36).substring(2, 8);

const CACHE_NAME = `cloudtak-cache-${VERSION}-${BUILD}`;

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
            const res = await fetch('./.vite/manifest.json');
            if (res.ok) {
                const manifest = await res.json();
                const assets = new Set(['./index.html']);

                Object.values(manifest).forEach((entry) => {
                    if (entry.file.endsWith('.html')) {
                        assets.add(`./${entry.file}`);
                    }

                    assets.add(`./${entry.src}`);

                    for (const imported of entry.imports || []) {
                        assets.add(imported);
                    }

                    for (const cssFile of entry.css || []) {
                        assets.add(cssFile);
                    }
                });

                await cache.addAll(Array.from(assets));
            }
        } catch (err) {
            console.warn('Failed to pre-cache Vite chunks:', err);
        }

        self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            })
        );
        await clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;
    if (
        event.request.url.includes('/api')
        && !event.request.url.includes('/api/iconset/')
    ) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // Cache First Strategy
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }

            try {
                const networkResponse = await fetch(event.request);

                // Cache valid responses
                if (networkResponse && networkResponse.status === 200) {
                    cache.put(event.request, networkResponse.clone());
                }

                return networkResponse;
            } catch (error) {
                // Fallback for navigation (SPA)
                if (event.request.mode === 'navigate') {
                    const cachedIndex = await cache.match('/index.html');
                    if (cachedIndex) return cachedIndex;
                    const cachedRoot = await cache.match('/');
                    if (cachedRoot) return cachedRoot;
                }

                throw error;
            }
        })()
    );
});
