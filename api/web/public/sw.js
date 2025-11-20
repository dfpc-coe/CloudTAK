const params = new URL(location).searchParams;
const VERSION = params.get('v') || Math.random().toString(36).substring(2, 8);

const CACHE_NAME = `cloudtak-cache-${VERSION}`;

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
            const res = await fetch('./.vite/manifest.json');
            if (res.ok) {
                const manifest = await res.json();
                const assets = new Set(['./', './index.html', './docs.html', './video.html']);

                Object.values(manifest).forEach((entry) => {
                    if (entry.file) assets.add(`./${entry.file}`);
                    if (entry.css) entry.css.forEach((c) => assets.add(`./${c}`));
                    if (entry.assets) entry.assets.forEach((a) => assets.add(`./${a}`));
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
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // Network First Strategy
            try {
                const networkResponse = await fetch(event.request);

                // Cache valid responses
                // We only cache basic type responses (same origin) to avoid caching opaque responses from other domains unless intended
                // However, for a map app, we might want to cache tiles from other domains if they are CORS enabled.
                // But 'basic' restricts to same-origin.
                // If the user wants "all assets", they might mean map tiles too.
                // Map tiles usually come from other domains (or /api/ which is proxied).
                // If /api/ is proxied, it's same origin.
                // If map tiles are external, 'basic' will filter them out.
                // Let's stick to 'basic' for safety unless we know we need CORS.
                if (networkResponse && networkResponse.status === 200) {
                    cache.put(event.request, networkResponse.clone());
                }

                return networkResponse;
            } catch (error) {
                // Network failed, try cache
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

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
