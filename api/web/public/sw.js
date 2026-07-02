const BUILD = new URL(location).searchParams.get('build');

console.log(`[SW] script evaluating — build=${BUILD ?? 'MISSING'} scriptURL=${location}`);

// Surface anything that throws or rejects inside the worker; without these
// a failed install/activate is easy to miss in the Firefox console.
self.addEventListener('error', (event) => {
    console.error('[SW] uncaught error:', event.message, `${event.filename}:${event.lineno}:${event.colno}`);
});
self.addEventListener('unhandledrejection', (event) => {
    console.error('[SW] unhandled promise rejection:', event.reason);
});

// Fail fast: without a build id the cache name is ambiguous — different
// deployments would collide in one cache and activate could purge valid
// caches. Throwing here rejects register(), so the previous SW keeps serving.
if (!BUILD) {
    console.error('[SW] Registered without the required `build` query parameter — aborting');
    throw new Error('[SW] Registered without the required `build` query parameter');
}

const CACHE_PREFIX = 'cloudtak-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD}`;

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
 * Walk the Vite manifest and return every URL to precache, following `imports`
 * and `dynamicImports` transitively (lazy chunks only appear under
 * `dynamicImports` and must not be missed). Worker bundles live under synthetic
 * `worker:` entries injected at build time (see vite.config.ts); they carry a
 * `file`, so this same walk precaches them too.
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

self.addEventListener('install', (event) => {
    console.log(`[SW] install start → ${CACHE_NAME}`);
    event.waitUntil((async () => {
        // `cache: 'no-store'` is critical: `updateViaCache: 'none'` on the SW
        // registration only prevents the *sw.js* script from being served by
        // the HTTP cache. Sub-resource fetches inside the SW (like this one)
        // still honor intermediary caches by default.
        const res = await fetch('./.vite/manifest.json', { cache: 'no-store' });
        if (!res.ok) {
            console.error(`[SW] install: manifest fetch failed (${res.status}) — install will abort`);
            throw new Error(`[SW] Manifest fetch failed: ${res.status}`);
        }
        const manifest = await res.json();

        // Atomic precache: if ANY URL fails, install rejects and the browser
        // keeps the previous service worker (and its complete cache). The
        // page re-registers on every load, so a failed install retries then.
        const assets = collectAssetsFromManifest(manifest);
        console.log(`[SW] install: precaching ${assets.length} assets`);
        const cache = await caches.open(CACHE_NAME);
        try {
            await cache.addAll(assets);
        } catch (err) {
            console.error('[SW] install: addAll failed — install will abort', err);
            throw err;
        }
        console.log('[SW] install complete');
    })());
});

// Sent by the App.vue update banner: activate immediately instead of waiting
// for every tab to close.
self.addEventListener('message', (event) => {
    console.log('[SW] message received:', event.data);
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    console.log(`[SW] activate start → ${CACHE_NAME}`);
    event.waitUntil((async () => {
        // Install is atomic, so reaching activate means CACHE_NAME is
        // complete and previous generations are safe to drop.
        const keys = await caches.keys();
        const stale = keys.filter((key) => key !== CACHE_NAME && key.startsWith(CACHE_PREFIX));
        if (stale.length) {
            console.log('[SW] activate: deleting stale caches', stale);
        }
        await Promise.all(stale.map((key) => caches.delete(key)));

        await self.clients.claim();
        console.log('[SW] activate complete — clients claimed');
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
async function navigationFallback(cache, pathname) {
    for (const entryPath of Object.values(ENTRY_HTML_TO_PATH)) {
        if (entryPath !== '/' && pathname.startsWith(entryPath)) {
            const match = await cache.match(entryPath);
            if (match) return match;
        }
    }

    return cache.match('/');
}

// Cache-first for everything, navigations included: the precached shell
// serves instantly even offline. Freshness comes from the cache generation
// swap — a new deploy installs a new SW whose activate replaces CACHE_NAME.
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

            if (networkResponse.status === 200 && isRuntimeCacheable(url)) {
                event.waitUntil(cache.put(url.toString(), networkResponse.clone()));
            }

            return networkResponse;
        } catch (error) {
            if (event.request.mode === 'navigate') {
                const fallback = await navigationFallback(cache, url.pathname);
                if (fallback) {
                    console.warn(`[SW] network failed for navigation ${url.pathname} — serving cached shell`);
                    return fallback;
                }
            }

            console.error(`[SW] fetch failed with no cached fallback: ${url.toString()}`, error);
            throw error;
        }
    })());
});
