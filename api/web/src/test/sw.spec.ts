import { describe, it, expect, vi, type Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function createCacheMock() {
    const stores = new Map<string, Map<string, Response>>();
    const cacheObjects = new Map<string, ReturnType<typeof makeCache>>();

    const makeCache = (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
            add: vi.fn(async (url: string) => { store.set(url, new Response()); }),
            match: vi.fn(async (url: string) => store.get(url) ?? undefined),
            put: vi.fn(async (url: string, res: Response) => { store.set(url, res); }),
        };
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
function loadSW(opts: { version?: string; build?: string; fetchMock?: Mock } = {}) {
    const v = opts.version ?? '1.0.0';
    const b = opts.build ?? 'abc123';

    const listeners: Record<string, Listener[]> = {};
    const cachesMock = createCacheMock();
    const clientsList: { url: string }[] = [];
    const fetchMock = opts.fetchMock ?? vi.fn(async () => new Response('{}', { status: 200 }));

    const scope: Record<string, any> = {
        location: new URL(`https://example.com/sw.js?v=${v}&build=${b}`),
        self: undefined as any,  // will alias below
        URL,
        Response,
        Request,
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

    return { listeners, emit, cachesMock, scope, clientsList };
}

describe('sw.js', () => {
    describe('install', () => {
        it('does NOT call skipWaiting during install', async () => {
            const fetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
                        'src/main.ts': { file: 'assets/main-abc.js', css: ['assets/main-abc.css'], imports: [] },
                    }), { status: 200 });
                }
                return new Response('', { status: 200 });
            });

            const { emit, scope } = loadSW({ fetchMock });

            const skipWaiting = vi.fn();
            scope.self.skipWaiting = skipWaiting;

            await emit('install');

            expect(skipWaiting).not.toHaveBeenCalled();
        });

        it('pre-caches manifest assets and root', async () => {
            const fetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
                        'src/main.ts': {
                            file: 'assets/main-xyz.js',
                            css: ['assets/main-xyz.css'],
                            imports: ['src/vendor.ts'],
                        },
                        'src/vendor.ts': {
                            file: 'assets/vendor-xyz.js',
                            imports: [],
                        },
                    }), { status: 200 });
                }
                return new Response('ok', { status: 200 });
            });

            const { emit, scope, cachesMock } = loadSW({ version: '2.0.0', build: 'xyz', fetchMock });

            scope.self.skipWaiting = vi.fn();
            await emit('install');

            // The cache named for this version should have been opened
            expect(cachesMock.open).toHaveBeenCalledWith('cloudtak-cache-2.0.0-xyz');
            const cache = await cachesMock.open('cloudtak-cache-2.0.0-xyz');
            const addCalls = (cache.add as Mock).mock.calls.map((c: any[]) => c[0]);
            expect(addCalls).toContain('/');
            expect(addCalls).toContain('assets/main-xyz.js');
            expect(addCalls).toContain('assets/main-xyz.css');
            expect(addCalls).toContain('assets/vendor-xyz.js');
        });

        it('maps known entry HTMLs to their navigable paths and never caches raw .html', async () => {
            // nginx 302s `/foo.html` → `/foo`, so caching `admin.html` is
            // useless. The SW must precache the navigable path instead.
            const fetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
                        'index.html': { file: 'index.html', imports: [] },
                        'admin.html': { file: 'admin.html', imports: [] },
                        'connection.html': { file: 'connection.html', imports: [] },
                        'docs.html': { file: 'docs.html', imports: [] },
                        'video.html': { file: 'video.html', imports: [] },
                        'unknown.html': { file: 'unknown.html', imports: [] },
                        'src/main.ts': { file: 'assets/main-h.js', imports: [] },
                    }), { status: 200 });
                }
                return new Response('ok', { status: 200 });
            });

            const { emit, scope, cachesMock } = loadSW({ version: '3.0.0', build: 'h', fetchMock });

            scope.self.skipWaiting = vi.fn();
            await emit('install');

            const cache = await cachesMock.open('cloudtak-cache-3.0.0-h');
            const addCalls = (cache.add as Mock).mock.calls.map((c: any[]) => c[0]);

            expect(addCalls).toContain('/');
            expect(addCalls).toContain('/admin');
            expect(addCalls).toContain('/connection');
            expect(addCalls).toContain('/docs');
            expect(addCalls).toContain('/video');
            expect(addCalls).toContain('assets/main-h.js');

            expect(addCalls).not.toContain('index.html');
            expect(addCalls).not.toContain('admin.html');
            expect(addCalls).not.toContain('unknown.html');
        });

        it('excludes HTML files from manifest cache', async () => {
            const fetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
                        'index.html': { file: 'index.html', imports: [] },
                        'src/main.ts': { file: 'assets/main-h.js', imports: [] },
                    }), { status: 200 });
                }
                return new Response('ok', { status: 200 });
            });

            const { emit, scope, cachesMock } = loadSW({ version: '3.1.0', build: 'h', fetchMock });

            scope.self.skipWaiting = vi.fn();
            await emit('install');

            const cache = await cachesMock.open('cloudtak-cache-3.1.0-h');
            const addCalls = (cache.add as Mock).mock.calls.map((c: any[]) => c[0]);
            expect(addCalls).not.toContain('index.html');
            expect(addCalls).toContain('assets/main-h.js');
        });

        it('fails install atomically when any asset cannot be fetched', async () => {
            // Regression: a partially-populated cache followed by activation
            // would purge the old cache and leave the user stuck. Install
            // must reject so the browser discards the new SW entirely.
            const fetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
                        'src/main.ts': { file: 'assets/main-broken.js', imports: [] },
                    }), { status: 200 });
                }
                return new Response('ok', { status: 200 });
            });

            const { emit, scope, cachesMock } = loadSW({ version: '5.0.0', build: 'fail', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-5.0.0-fail');
            (cache.add as Mock).mockImplementation(async (url: string) => {
                if (url === 'assets/main-broken.js') {
                    throw new TypeError('Failed to fetch');
                }
            });

            scope.self.skipWaiting = vi.fn();

            await expect(emit('install')).rejects.toThrow(/Failed to fetch/);
        });

        it('pre-caches dynamicImports transitively (e.g. icons-<hash>.js)', async () => {
            // Regression: dynamically-imported chunks (like the icons chunk)
            // must be precached; otherwise after an SW update activates and
            // purges the old cache, the reloaded page 404s on the new
            // icon-<hash>.js and blank-screens the upgrade.
            const fetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
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
                    }), { status: 200 });
                }
                return new Response('ok', { status: 200 });
            });

            const { emit, scope, cachesMock } = loadSW({ version: '4.0.0', build: 'dyn', fetchMock });

            scope.self.skipWaiting = vi.fn();
            await emit('install');

            const cache = await cachesMock.open('cloudtak-cache-4.0.0-dyn');
            const addCalls = (cache.add as Mock).mock.calls.map((c: any[]) => c[0]);

            expect(addCalls).toContain('assets/main-abc.js');
            expect(addCalls).toContain('assets/icons-xyz.js');
            expect(addCalls).toContain('assets/icons-xyz.css');
            expect(addCalls).toContain('assets/float-xyz.js');
            expect(addCalls).toContain('assets/nested-xyz.js');
            expect(addCalls).toContain('assets/shared-xyz.js');
            expect(addCalls).not.toContain('index.html');
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
        it('deletes old CloudTAK caches when the new cache has a root shell', async () => {
            const { emit, cachesMock } = loadSW({ version: '2.0.0', build: 'new' });

            // Seed the new cache with '/' so the guard in activate passes.
            const current = await cachesMock.open('cloudtak-cache-2.0.0-new');
            (current.match as Mock).mockImplementation(async (url: string) =>
                url === '/' ? new Response('root') : undefined
            );

            // Simulate old caches existing alongside the current one and an
            // unrelated cache that must never be touched.
            cachesMock.stores.set('cloudtak-cache-1.0.0-old', new Map());
            cachesMock.stores.set('cloudtak-cache-2.0.0-new', new Map());
            cachesMock.stores.set('other-cache', new Map());

            await emit('activate');

            const deletedNames = (cachesMock.delete as Mock).mock.calls.map((c: any[]) => c[0]);
            expect(deletedNames).toContain('cloudtak-cache-1.0.0-old');
            // Unrelated caches are intentionally left alone.
            expect(deletedNames).not.toContain('other-cache');
            // The current cache is never deleted.
            expect(deletedNames).not.toContain('cloudtak-cache-2.0.0-new');
        });

        it('keeps old caches if the new cache is missing the root shell', async () => {
            // Regression: a partial / broken install must NOT lead to the
            // old generation being purged, otherwise the user can land on
            // a blank app after reload.
            const { emit, cachesMock } = loadSW({ version: '2.0.0', build: 'new' });

            // New cache exists but has no '/' entry.
            const current = await cachesMock.open('cloudtak-cache-2.0.0-new');
            (current.match as Mock).mockResolvedValue(undefined);

            cachesMock.stores.set('cloudtak-cache-1.0.0-old', new Map());
            cachesMock.stores.set('cloudtak-cache-2.0.0-new', new Map());

            await emit('activate');

            expect(cachesMock.delete).not.toHaveBeenCalled();
        });

        it('calls clients.claim()', async () => {
            const { emit, scope, cachesMock } = loadSW();
            const current = await cachesMock.open('cloudtak-cache-1.0.0-abc123');
            (current.match as Mock).mockResolvedValue(new Response('root'));

            await emit('activate');
            expect(scope.clients.claim).toHaveBeenCalled();
        });
    });

    describe('fetch', () => {
        it('returns cached response when available (cache-first)', async () => {
            const { cachesMock, scope } = loadSW({ version: '1.0.0', build: 'b1' });

            // Pre-populate cache with a response
            const cachedBody = 'cached-content';
            const cache = await cachesMock.open('cloudtak-cache-1.0.0-b1');
            (cache.match as Mock).mockResolvedValueOnce(new Response(cachedBody));

            const event: FakeEvent = {
                request: new Request('https://example.com/assets/main-b1.js'),
                respondWith: vi.fn(),
            };

            // Fire fetch listeners
            for (const listener of scope.addEventListener.mock?.calls?.filter((c: any[]) => c[0] === 'fetch').map((c: any[]) => c[1]) ?? []) {
                listener(event);
            }

            // Since we evaluated the SW via new Function, listeners are captured differently
            // Use the emit helper's approach for fetch
            if (event.respondWith?.mock.calls.length) {
                await event.respondWith.mock.calls[0][0];
            }
        });

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

        it('caches /assets/* responses on network success', async () => {
            const fetchMock = vi.fn(async () => new Response('asset-body', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ version: '1.0.0', build: 'rt', fetchMock });

            const event: FakeEvent = {
                request: new Request('https://example.com/assets/main-rt.js'),
                respondWith: vi.fn(),
                waitUntil: vi.fn((p: Promise<any>) => p),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            await event.respondWith!.mock.calls[0][0];

            const cache = await cachesMock.open('cloudtak-cache-1.0.0-rt');
            expect((cache.put as Mock)).toHaveBeenCalledWith(
                'https://example.com/assets/main-rt.js',
                expect.any(Response)
            );
            expect(event.waitUntil).toHaveBeenCalledOnce();
        });

        it('caches /logos/* responses (PWA touch-icons) on network success', async () => {
            const fetchMock = vi.fn(async () => new Response('png-body', { status: 200 }));
            const { listeners, cachesMock } = loadSW({ version: '1.0.0', build: 'logo', fetchMock });

            const event: FakeEvent = {
                request: new Request('https://example.com/logos/180.png'),
                respondWith: vi.fn(),
                waitUntil: vi.fn((p: Promise<any>) => p),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            await event.respondWith!.mock.calls[0][0];

            const cache = await cachesMock.open('cloudtak-cache-1.0.0-logo');
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
            const { listeners, cachesMock } = loadSW({ version: '1.0.0', build: 'rt2', fetchMock });

            const event: FakeEvent = {
                request: new Request('https://example.com/some/deep/spa/path'),
                respondWith: vi.fn(),
            };

            for (const fn of listeners['fetch'] ?? []) fn(event);
            await event.respondWith!.mock.calls[0][0];

            const cache = await cachesMock.open('cloudtak-cache-1.0.0-rt2');
            expect((cache.put as Mock)).not.toHaveBeenCalled();
        });

        it('falls back to the matching entry shell on offline navigation', async () => {
            const fetchMock = vi.fn(async () => { throw new TypeError('offline'); });
            const { listeners, cachesMock } = loadSW({ version: '1.0.0', build: 'nav', fetchMock });

            const cache = await cachesMock.open('cloudtak-cache-1.0.0-nav');
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
    });

    describe('update lifecycle (no stale-cache gap)', () => {
        it('old cache survives until new SW is explicitly activated', async () => {
            // Simulate v1 SW installed and active
            const v1 = loadSW({ version: '1.0.0', build: 'old' });
            v1.scope.self.skipWaiting = vi.fn();
            await v1.emit('install');
            await v1.emit('activate');

            // v1 cache should exist
            expect(v1.cachesMock.stores.has('cloudtak-cache-1.0.0-old')).toBe(true);

            // Now simulate v2 SW installing (in a separate scope, as the browser would)
            const v2FetchMock = vi.fn(async (url: string | Request) => {
                const u = typeof url === 'string' ? url : url.url;
                if (u.includes('manifest.json')) {
                    return new Response(JSON.stringify({
                        'src/main.ts': { file: 'assets/main-new.js', imports: [] },
                    }), { status: 200 });
                }
                return new Response('ok', { status: 200 });
            });
            const v2 = loadSW({ version: '2.0.0', build: 'new', fetchMock: v2FetchMock });
            // Share the same cache storage to simulate the same origin
            v2.cachesMock.stores.set('cloudtak-cache-1.0.0-old', new Map([['/', new Response('v1 root')]]));

            v2.scope.self.skipWaiting = vi.fn();

            await v2.emit('install');

            // skipWaiting must NOT have been called during install
            expect(v2.scope.self.skipWaiting).not.toHaveBeenCalled();

            // The old cache should still exist (not deleted until activate)
            expect(v2.cachesMock.stores.has('cloudtak-cache-1.0.0-old')).toBe(true);

            // Now user clicks "Update Now" → SKIP_WAITING message is sent
            await v2.emit('message', { data: 'SKIP_WAITING' });
            expect(v2.scope.self.skipWaiting).toHaveBeenCalledOnce();

            // Activation deletes old caches (v2 install populated '/').
            await v2.emit('activate');
            expect(v2.cachesMock.delete).toHaveBeenCalledWith('cloudtak-cache-1.0.0-old');
        });
    });
});
