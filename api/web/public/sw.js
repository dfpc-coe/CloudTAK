const CACHE_NAME = `cloudtak-cache-${Math.random().toString(36).substring(2, 15)}`;

self.addEventListener('install', (event) => {
    self.skipWaiting();
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
