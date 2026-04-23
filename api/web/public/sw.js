const params = new URL(location).searchParams;
const VERSION = params.get('v') || Math.random().toString(36).substring(2, 8);
const BUILD  = params.get('build') || Math.random().toString(36).substring(2, 8);

const CACHE_NAME = `cloudtak-cache-${VERSION}-${BUILD}`;
const CACHE_PREFIX = 'cloudtak-cache-';

// Vite emits one manifest entry per HTML page. Each must be precached under
// the navigable path nginx serves it from (the browser never requests the
// raw `.html` — those are 302'd away by the nginx config).
const ENTRY_HTML_TO_PATH = {
    'index.html': '/',
    'admin.html': '/admin',
    'connection.html': '/connection',
    'docs.html': '/docs',
    'video.html': '/video',
};

/**
 * Walk the Vite manifest and return every URL that must be precached.
 * Both `imports` and `dynamicImports` are followed transitively: lazy
 * chunks (icons, floating UI, per-route components) only appear under
 * `dynamicImports` and must not be missed or the post-update reload
 * will 404 on them.
 */
function collectAssetsFromManifest(manifest) {
    const assets = new Set(['/']);
    const visited = new Set();

    const walk = (key) => {
        if (!key || visited.has(key)) return;
        visited.add(key);

        const entry = manifest[key];
        if (!entry) return;

        if (entry.file) {
            if (entry.file.endsWith('.html')) {
                const navPath = ENTRY_HTML_TO_PATH[entry.file];
                if (navPath) assets.add(navPath);
            } else {
                assets.add(entry.file);
            }
        }

        for (const cssFile of entry.css || []) assets.add(cssFile);
        for (const imported of entry.imports || []) walk(imported);
        for (const imported of entry.dynamicImports || []) walk(imported);
    };

    for (const key of Object.keys(manifest)) walk(key);

    return Array.from(assets);
}

async function fetchManifest() {
    try {
        // `cache: 'no-store'` is critical: `updateViaCache: 'none'` on the SW
        // registration only prevents the *sw.js* script from being served by
        // the HTTP cache. Sub-resource fetches inside the SW (like this one)
        // still honor intermediary caches by default. A stale manifest here
        // causes the new SW to precache stale URLs (or 404 mid-install,
        // aborting the upgrade).
        const res = await fetch('./.vite/manifest.json', { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.warn('[SW] Failed to obtain Vite manifest:', err);
        return null;
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const manifest = await fetchManifest();
        const urls = manifest ? collectAssetsFromManifest(manifest) : ['/'];

        const cache = await caches.open(CACHE_NAME);

        // Atomic precache: if ANY URL fails, install rejects and the
        // browser keeps the old SW installed. Prefer cache.addAll() (the
        // spec'd atomic variant); fall back to parallel cache.add() for
        // test doubles that don't implement addAll. A single rejection
        // aborts install in either branch.
        if (typeof cache.addAll === 'function') {
            await cache.addAll(urls);
        } else {
            await Promise.all(urls.map((url) => cache.add(url)));
        }

        console.log(`[SW] Precached ${urls.length} assets into ${CACHE_NAME}`);
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Only purge old CloudTAK caches once the new cache is proven
        // usable (contains the root shell). If anything is wrong, leave
        // previous generations in place so clients keep a working app.
        const newCache = await caches.open(CACHE_NAME);
        const rootShell = await newCache.match('/');

        if (rootShell) {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME && key.startsWith(CACHE_PREFIX))
                    .map((key) => caches.delete(key))
            );
        } else {
            console.warn(`[SW] ${CACHE_NAME} missing root shell; keeping old caches.`);
        }

        await self.clients.claim();
    })());
});

/**
 * Opportunistic runtime caching is intentionally narrow:
 *   - `/assets/*`  fingerprinted build output, immutable by URL.
 *   - `/logos/*`   PWA touch-icons and favicons referenced from every
 *                  entry HTML's `<link>` tags. Non-fingerprinted but
 *                  rotated with the cache generation on activate.
 * Everything else - HTML, `/icons/*` sprite data, plugin responses - is
 * either precached or goes straight to the network, so an nginx SPA
 * fallback response cannot be cached under an arbitrary path.
 */
function isRuntimeCacheable(url) {
    return url.pathname.startsWith('/assets/')
        || url.pathname.startsWith('/logos/');
}

/**
 * Navigation fallback when the network is unreachable. Prefers the cached
 * entry shell that matches the request path, then falls back to `/`.
 */
async function navigationFallback(cache, requestUrl) {
    const pathname = requestUrl.pathname;

    for (const entryPath of Object.values(ENTRY_HTML_TO_PATH)) {
        if (entryPath !== '/' && pathname.startsWith(entryPath)) {
            const match = await cache.match(entryPath);
            if (match) return match;
        }
    }

    return cache.match('/');
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    url.hash = '';

    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api')) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        const cachedResponse = await cache.match(url.toString());
        if (cachedResponse) return cachedResponse;

        try {
            const networkResponse = await fetch(event.request);

            if (networkResponse && networkResponse.status === 200 && isRuntimeCacheable(url)) {
                event.waitUntil(cache.put(url.toString(), networkResponse.clone()));
            }

            return networkResponse;
        } catch (error) {
            console.error(`[SW] Fetch failed for ${url.toString()}`, error);

            if (event.request.mode === 'navigate') {
                const fallback = await navigationFallback(cache, url);
                if (fallback) return fallback;
            }

            throw error;
        }
    })());
});
