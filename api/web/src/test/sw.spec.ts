import { describe, it, expect, vi, type Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function createCacheMock() {
    const stores = new Map<string, Map<string, Response>>();
    const cacheObjects = new Map<string, ReturnType<typeof makeCache>>();

    const makeCache = (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        const cache = {
            add: vi.fn(async (url: string) => { store.set(url, new Response()); }),
            // Real Cache.addAll() is atomic: either every URL is cached or
            // none are. Roll back on failure so tests cannot pass against a
            // partially-populated cache.
            addAll: vi.fn(async (urls: string[]) => {
                const snapshot = new Map(store);
                try {
                    await Promise.all(urls.map((url) => cache.add(url)));
                } catch (err) {
                    store.clear();
                    for (const [key, value] of snapshot) store.set(key, value);
                    throw err;
                }
            }),
            match: vi.fn(async (url: string) => store.get(url) ?? undefined),
            put: vi.fn(async (url: string, res: Response) => { store.set(url, res); }),
        };
        return cache;
    };

    const openCache = (name: string) => {
        if (!cacheObjects.has(name)) cacheObjects.set(name, makeCache(name));
        return cacheObjects.get(name)!;
    };

    return {
        stores,
        open: vi.fn(async (name: string) => openCache(name)),
        keys: vi.fn(async () => Array.from(stores.keys())),
        delete: vi.fn(async (name: string) => stores.delete(name)),
    };
}

type Listener = (...args: any[]) => any;

interface FakeEvent {
    waitUntil?: Mock;
    respondWith?: Mock;
    request?: Request;
    data?: any;
    preventDefault?: Mock;
}

/**
 * Build a minimal ServiceWorkerGlobalScope, evaluate the SW source inside it,
 * and return the captured event listeners.
 */
function loadSW(opts: { build?: string | null; fetchMock?: Mock } = {}) {
    const b = opts.build === undefined ? 'abc123' : opts.build;

    const listeners: Record<string, Listener[]> = {};
    const cachesMock = createCacheMock();
    const clientsList: { url: string }[] = [];
    const fetchMock = opts.fetchMock ?? vi.fn(async () => new Response('{}', { status: 200 }));

    const scope: Record<string, any> = {
        location: new URL(b === null ? 'https://example.com/sw.js' : `https://example.com/sw.js?build=${b}`),
        self: undefined as any,  // will alias below
        URL,
        Response,
        Request,
        Error,
        caches: cachesMock,
        clients: {
            claim: vi.fn(async () => {}),
            matchAll: vi.fn(async () => clientsList),
        },
        fetch: fetchMock,
        console,
        addEventListener: (type: string, fn: Listener) => {
            (listeners[type] ??= []).push(fn);
        },
    };
    scope.self = scope;

    // Evaluate the SW source in the fake scope
    const swSource = fs.readFileSync(
        path.resolve(__dirname, '../../public/sw.js'),
        'utf-8',
    );
    const fn = new Function(...Object.keys(scope), swSource);
    fn(...Object.values(scope));

    /** Fire all registered listeners for a given event type */
    const emit = async (type: string, event: FakeEvent = {}) => {
        event.waitUntil ??= vi.fn((p: Promise<any>) => p);
        for (const listener of listeners[type] ?? []) {
            await listener(event);
        }
        // Await any promise passed to waitUntil
        for (const call of event.waitUntil.mock.calls) {
            await call[0];
        }
    };

    /** URLs passed to cache.addAll during install */
    const precachedUrls = async (cacheName: string) => {
        const cache = await cachesMock.open(cacheName);
        return (cache.addAll as Mock).mock.calls.flatMap((c: any[]) => c[0]);
    };

    return { listeners, emit, cachesMock, scope, clientsList, precachedUrls };
}

function manifestFetchMock(manifest: Record<string, any>): Mock {
    return vi.fn(async (url: string | Request) => {
        const u = typeof url === 'string' ? url : url.url;
        if (u.includes('manifest.json')) {
            return new Response(JSON.stringify(manifest), { status: 200 });
        }
        return new Response('ok', { status: 200 });
    });
}

describe('sw.js', () => {
    it('refuses to load without a `build` query parameter', () => {
        // Without a build id the cache name would be ambiguous — different
        // deployments would collide in one cache and activate could purge
        // valid caches. The throw rejects register(), keeping the old SW.
        expect(() => loadSW({ build: null })).toThrow(/build/);
    });

    describe('install', () => {
        it('pre-caches manifest assets and root atomically via addAll', async () => {
            const fetchMock = manifestFetchMock({
                'src/main.ts': {
                    file: 'assets/main-xyz.js',
                    css: ['assets/main-xyz.css'],
                    imports: ['src/vendor.ts'],
                },
                'src/vendor.ts': {
                    file: 'assets/vendor-xyz.js',
                    imports: [],
                },
            });

            const { emit, cachesMock, precachedUrls } = loadSW({ build: 'xyz', fetchMock });

            await emit('install');

            expect(cachesMock.open).toHaveBeenCalledWith('cloudtak-cache-xyz');
            const urls = await precachedUrls('cloudtak-cache-xyz');
            expect(urls).toContain('/');
            expect(urls).toContain('assets/main-xyz.js');
            expect(urls).toContain('assets/main-xyz.css');
            expect(urls).toContain('assets/vendor-xyz.js');
        });

        it('maps known entry HTMLs to their navigable paths and never caches raw .html', async () => {
            // nginx 302s `/foo.html` → `/foo`, so caching `admin.html` is
            // useless. The SW must precache the navigable path instead.
            const fetchMock = manifestFetchMock({
                'index.html': { file: 'index.html', imports: [] },
                'admin.html': { file: 'admin.html', imports: [] },
                'connection.html': { file: 'connection.html', imports: [] },
                'docs.html': { file: 'docs.html', imports: [] },
                'video.html': { file: 'video.html', imports: [] },
                'unknown.html': { file: 'unknown.html', imports: [] },
                'src/main.ts': { file: 'assets/main-h.js', imports: [] },
            });

            const { emit, precachedUrls } = loadSW({ build: 'h', fetchMock });

            await emit('install');

            const urls = await precachedUrls('cloudtak-cache-h');
            expect(urls).toContain('/');
            expect(urls).toContain('/admin');
            expect(urls).toContain('/connection');
            expect(urls).toContain('/docs');
            expect(urls).toContain('/video');
            expect(urls).toContain('assets/main-h.js');

            expect(urls).not.toContain('index.html');
            expect(urls).not.toContain('admin.html');
            expect(urls).not.toContain('unknown.html');
        });

        it('fails install when the manifest cannot be fetched', async () => {
            // A failed install leaves the previous SW (and its complete
            // cache) active; the page re-registers on every load so the
            // install retries then.
            const fetchMock = vi.fn(async () => new Response('gone', { status: 404 }));
            const { emit } = loadSW({ build: 'nomanifest', fetchMock });

            await expect(emit('install')).rejects.toThrow(/Manifest fetch failed/);
        });

        it('fails install atomically when any asset cannot be fetched', async () => {
            // Regression: a partially-populated cache followed by activation
            // would purge the old cache and leave the user stuck. Install
            // must reject so the browser discards the new SW entirely.
            const fetchMock = manifestFetchMock({
                'src/main.ts': { file: 'assets/main-ok.js', imports: [] },
                'src/broken.ts': { file: 'assets/main-broken.js', imports: [] },
            });

            const { emit, cachesMock } = loadSW({ build: 'fail', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-fail');
            (cache.add as Mock).mockImplementation(async (url: string) => {
                if (url === 'assets/main-broken.js') {
                    throw new TypeError('Failed to fetch');
                }
                cachesMock.stores.get('cloudtak-cache-fail')!.set(url, new Response());
            });

            await expect(emit('install')).rejects.toThrow(/Failed to fetch/);

            // addAll is atomic: the URLs that fetched fine must not linger
            // in the cache after the failed install.
            expect(cachesMock.stores.get('cloudtak-cache-fail')!.size).toBe(0);
        });

        it('pre-caches dynamicImports transitively (e.g. icons-<hash>.js)', async () => {
            // Regression: dynamically-imported chunks (like the icons chunk)
            // must be precached; otherwise after an SW update activates and
            // purges the old cache, the reloaded page 404s on the new
            // icon-<hash>.js and blank-screens the upgrade.
            const fetchMock = manifestFetchMock({
                'index.html': {
                    file: 'index.html',
                    imports: ['src/main.ts'],
                },
                'src/main.ts': {
                    file: 'assets/main-abc.js',
                    imports: [],
                    dynamicImports: ['_icons-lazy.js', '_float-lazy.js'],
                },
                '_icons-lazy.js': {
                    file: 'assets/icons-xyz.js',
                    css: ['assets/icons-xyz.css'],
                    imports: ['_shared.js'],
                    dynamicImports: [],
                },
                '_float-lazy.js': {
                    file: 'assets/float-xyz.js',
                    imports: [],
                    dynamicImports: ['_nested-lazy.js'],
                },
                '_nested-lazy.js': {
                    file: 'assets/nested-xyz.js',
                    imports: [],
                    dynamicImports: [],
                },
                '_shared.js': {
                    file: 'assets/shared-xyz.js',
                    imports: [],
                    dynamicImports: [],
                },
            });

            const { emit, precachedUrls } = loadSW({ build: 'dyn', fetchMock });

            await emit('install');

            const urls = await precachedUrls('cloudtak-cache-dyn');
            expect(urls).toContain('assets/main-abc.js');
            expect(urls).toContain('assets/icons-xyz.js');
            expect(urls).toContain('assets/icons-xyz.css');
            expect(urls).toContain('assets/float-xyz.js');
            expect(urls).toContain('assets/nested-xyz.js');
            expect(urls).toContain('assets/shared-xyz.js');
            expect(urls).not.toContain('index.html');
        });

        it('pre-caches worker chunks injected into the manifest', async () => {
            // Worker bundles aren't in the base manifest; the build injects them
            // as synthetic `worker:` entries so the walk precaches them. Without
            // this, `new Worker(...)` 404s after a deploy.
            const fetchMock = manifestFetchMock({
                'src/main.ts': { file: 'assets/main-abc.js', imports: [] },
                'worker:assets/atlas-abc.js': { file: 'assets/atlas-abc.js', src: 'worker:assets/atlas-abc.js' },
                'worker:assets/dist-abc.js': { file: 'assets/dist-abc.js', src: 'worker:assets/dist-abc.js' },
                'worker:assets/maplibre-gl-worker-abc.js': { file: 'assets/maplibre-gl-worker-abc.js', src: 'worker:assets/maplibre-gl-worker-abc.js' },
            });

            const { emit, precachedUrls } = loadSW({ build: 'wrk', fetchMock });

            await emit('install');

            const urls = await precachedUrls('cloudtak-cache-wrk');
            expect(urls).toContain('assets/main-abc.js');
            expect(urls).toContain('assets/atlas-abc.js');
            expect(urls).toContain('assets/dist-abc.js');
            expect(urls).toContain('assets/maplibre-gl-worker-abc.js');
        });

        it('installs normally when the manifest has no worker entries', async () => {
            const fetchMock = manifestFetchMock({
                'src/main.ts': { file: 'assets/main-abc.js', imports: [] },
            });

            const { emit, precachedUrls } = loadSW({ build: 'nowrk', fetchMock });

            await emit('install');

            const urls = await precachedUrls('cloudtak-cache-nowrk');
            expect(urls).toContain('assets/main-abc.js');
        });
    });

    describe('message (SKIP_WAITING)', () => {
        it('calls skipWaiting when SKIP_WAITING message is received', async () => {
            const { emit, scope } = loadSW();
            const skipWaiting = vi.fn();
            scope.self.skipWaiting = skipWaiting;

            await emit('message', { data: 'SKIP_WAITING' });

            expect(skipWaiting).toHaveBeenCalledOnce();
        });

        it('ignores other messages', async () => {
            const { emit, scope } = loadSW();
            const skipWaiting = vi.fn();
            scope.self.skipWaiting = skipWaiting;

            await emit('message', { data: 'SOMETHING_ELSE' });
            await emit('message', { data: null });

            expect(skipWaiting).not.toHaveBeenCalled();
        });
    });

    describe('activate', () => {
        it('deletes old CloudTAK caches but leaves unrelated caches alone', async () => {
            const { emit, cachesMock } = loadSW({ build: 'new' });

            cachesMock.stores.set('cloudtak-cache-old', new Map());
            cachesMock.stores.set('cloudtak-cache-13.0.0-legacy', new Map());
            cachesMock.stores.set('cloudtak-cache-new', new Map());
            cachesMock.stores.set('other-cache', new Map());

            await emit('activate');

            const deletedNames = (cachesMock.delete as Mock).mock.calls.map((c: any[]) => c[0]);
            expect(deletedNames).toContain('cloudtak-cache-old');
            // Caches from the previous `<version>-<build>` naming scheme are
            // purged by the same prefix filter.
            expect(deletedNames).toContain('cloudtak-cache-13.0.0-legacy');
            expect(deletedNames).not.toContain('other-cache');
            expect(deletedNames).not.toContain('cloudtak-cache-new');
        });

        it('calls clients.claim()', async () => {
            const { emit, scope } = loadSW();

            await emit('activate');
            expect(scope.clients.claim).toHaveBeenCalled();
        });
    });

    describe('fetch', () => {
        it('skips non-GET requests', async () => {
            const { listeners } = loadSW();
            const event: FakeEvent = {
                request: new Request('https://example.com/data', { method: 'POST' }),
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) {
                fn(event);
            }

            expect(event.respondWith).not.toHaveBeenCalled();
        });

        it('skips /api requests', async () => {
            const { listeners } = loadSW();
            const event: FakeEvent = {
                request: new Request('https://example.com/api/users'),
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) {
                fn(event);
            }

            expect(event.respondWith).not.toHaveBeenCalled();
        });

        it('skips cross-origin requests', async () => {
            const { listeners } = loadSW();
            const event: FakeEvent = {
                request: new Request('https://other-domain.com/script.js'),
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) {
                fn(event);
            }

            expect(event.respondWith).not.toHaveBeenCalled();
        });

        it('serves cached assets without hitting the network (cache-first)', async () => {
            const fetchMock = vi.fn(async () => new Response('network-body', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ build: 'b1', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-b1');
            (cache.match as Mock).mockResolvedValueOnce(new Response('cached-body'));

            const event: FakeEvent = {
                request: new Request('https://example.com/assets/main-b1.js'),
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            const response = await event.respondWith!.mock.calls[0][0];

            await expect(response.text()).resolves.toBe('cached-body');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('caches /assets/* responses on network success', async () => {
            const fetchMock = vi.fn(async () => new Response('asset-body', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ build: 'rt', fetchMock });

            const event: FakeEvent = {
                request: new Request('https://example.com/assets/main-rt.js'),
                respondWith: vi.fn(),
                waitUntil: vi.fn((p: Promise<any>) => p),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            await event.respondWith!.mock.calls[0][0];

            const cache = await cachesMock.open('cloudtak-cache-rt');
            expect((cache.put as Mock)).toHaveBeenCalledWith(
                'https://example.com/assets/main-rt.js',
                expect.any(Response)
            );
            expect(event.waitUntil).toHaveBeenCalledOnce();
        });

        it('caches /logos/* responses (PWA touch-icons) on network success', async () => {
            const fetchMock = vi.fn(async () => new Response('png-body', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ build: 'logo', fetchMock });

            const event: FakeEvent = {
                request: new Request('https://example.com/logos/180.png'),
                respondWith: vi.fn(),
                waitUntil: vi.fn((p: Promise<any>) => p),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            await event.respondWith!.mock.calls[0][0];

            const cache = await cachesMock.open('cloudtak-cache-logo');
            expect((cache.put as Mock)).toHaveBeenCalledWith(
                'https://example.com/logos/180.png',
                expect.any(Response)
            );
            expect(event.waitUntil).toHaveBeenCalledOnce();
        });

        it('does NOT cache non-/assets responses even on 200', async () => {
            // Regression: the nginx SPA fallback returns `/index.html` with a
            // 200 for unknown paths. Caching those under arbitrary URLs used
            // to pin wrong HTML inside the SW generation.
            const fetchMock = vi.fn(async () => new Response('<html>root</html>', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ build: 'rt2', fetchMock });

            const event: FakeEvent = {
                request: new Request('https://example.com/some/deep/spa/path'),
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            await event.respondWith!.mock.calls[0][0];

            const cache = await cachesMock.open('cloudtak-cache-rt2');
            expect((cache.put as Mock)).not.toHaveBeenCalled();
        });

        it('serves cached navigations without hitting the network (offline-first)', async () => {
            const fetchMock = vi.fn(async () => new Response('<html>network</html>', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ build: 'nav1', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-nav1');
            (cache.match as Mock).mockImplementation(async (url: string) =>
                url === 'https://example.com/' ? new Response('<html>cached shell</html>') : undefined
            );

            const event: FakeEvent = {
                request: {
                    url: 'https://example.com/',
                    method: 'GET',
                    mode: 'navigate',
                } as unknown as Request,
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            const response = await event.respondWith!.mock.calls[0][0];

            await expect(response.text()).resolves.toContain('cached shell');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('falls back to the matching entry shell on offline navigation', async () => {
            const fetchMock = vi.fn(async () => { throw new TypeError('offline'); });
            const { listeners, cachesMock } = loadSW({ build: 'nav2', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-nav2');
            (cache.match as Mock).mockImplementation(async (url: string) => {
                if (url === '/admin') return new Response('<html>admin shell</html>');
                if (url === '/') return new Response('<html>root shell</html>');
                return undefined;
            });

            // `mode: 'navigate'` cannot be constructed directly on a Request,
            // so simulate the navigation request with a plain object the SW
            // can destructure just like a real FetchEvent.request.
            const event: FakeEvent = {
                request: {
                    url: 'https://example.com/admin/users',
                    method: 'GET',
                    mode: 'navigate',
                } as unknown as Request,
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            const response = await event.respondWith!.mock.calls[0][0];
            await expect(response.text()).resolves.toContain('admin shell');
        });

        it('falls back to the root shell on offline navigation to SPA paths', async () => {
            const fetchMock = vi.fn(async () => { throw new TypeError('offline'); });
            const { listeners, cachesMock } = loadSW({ build: 'nav3', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-nav3');
            (cache.match as Mock).mockImplementation(async (url: string) =>
                url === '/' ? new Response('<html>root shell</html>') : undefined
            );

            const event: FakeEvent = {
                request: {
                    url: 'https://example.com/menu/settings',
                    method: 'GET',
                    mode: 'navigate',
                } as unknown as Request,
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            const response = await event.respondWith!.mock.calls[0][0];
            await expect(response.text()).resolves.toContain('root shell');
        });
    });

    describe('update lifecycle (no stale-cache gap)', () => {
        it('old cache survives a new install and is purged only on activate', async () => {
            // Simulate v1 SW installed and active
            const v1 = loadSW({
                build: 'old',
                fetchMock: manifestFetchMock({
                    'src/main.ts': { file: 'assets/main-old.js', imports: [] },
                }),
            });
            await v1.emit('install');
            await v1.emit('activate');

            expect(v1.cachesMock.stores.has('cloudtak-cache-old')).toBe(true);

            // Now simulate v2 SW installing (in a separate scope, as the browser would)
            const v2 = loadSW({
                build: 'new',
                fetchMock: manifestFetchMock({
                    'src/main.ts': { file: 'assets/main-new.js', imports: [] },
                }),
            });
            // Share the same cache storage to simulate the same origin
            v2.cachesMock.stores.set('cloudtak-cache-old', new Map([['/', new Response('v1 root')]]));

            v2.scope.self.skipWaiting = vi.fn();
            await v2.emit('install');

            // skipWaiting must NOT have been called during install
            expect(v2.scope.self.skipWaiting).not.toHaveBeenCalled();

            // The old cache still exists (not deleted until activate), so old
            // tabs keep lazy-loading their own build's chunks.
            expect(v2.cachesMock.stores.has('cloudtak-cache-old')).toBe(true);

            // Now user clicks "Update Now" → SKIP_WAITING message is sent
            await v2.emit('message', { data: 'SKIP_WAITING' });
            expect(v2.scope.self.skipWaiting).toHaveBeenCalledOnce();

            await v2.emit('activate');
            expect(v2.cachesMock.delete).toHaveBeenCalledWith('cloudtak-cache-old');
        });
    });
});
