const params = new URL(location).searchParams;
const VERSION = params.get('v') || Math.random().toString(36).substring(2, 8);
const BUILD  = params.get('build') || Math.random().toString(36).substring(2, 8);

const CACHE_NAME = `cloudtak-cache-${VERSION}-${BUILD}`;

self.addEventListener('install', (event) => {
    self.skipWaiting();

    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
            const res = await fetch('./.vite/manifest.json');
            if (res.ok) {
                const manifest = await res.json();

                const assets = new Set(['/']);

                Object.values(manifest).forEach((entry) => {
                    if (entry.file && !entry.file.endsWith('.html')) {
                        assets.add(entry.file);
                    }

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
    })());
});

self.addEventListener('activate', async (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();

        await Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            })
        );
    })());

    await clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    url.hash = '';

    if (event.request.method !== 'GET') return;

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;
    if (event.request.url.includes('/api')) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // Cache First Strategy
            const cachedResponse = await cache.match(url.toString());
            if (cachedResponse) {
                return cachedResponse;
            }

            try {
                const networkResponse = await fetch(event.request);

                // Cache valid responses
                if (networkResponse && networkResponse.status === 200) {
                    cache.put(url.toString(), networkResponse.clone());
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
