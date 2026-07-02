import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyServiceWorkerUpdate, initServiceWorker } from './service-worker.ts';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

async function flushPromises(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

interface MockRegistration {
    scope: string;
    waiting: ServiceWorker | null;
    installing: ServiceWorker | null;
    active: ServiceWorker | null;
    addEventListener: ReturnType<typeof vi.fn>;
}

function makeRegistration(overrides: Partial<MockRegistration> = {}): MockRegistration {
    return {
        scope: '/',
        waiting: null,
        installing: null,
        active: null,
        addEventListener: vi.fn(),
        ...overrides,
    };
}

describe('service-worker registration lifecycle', () => {
    const originalServiceWorker = navigator.serviceWorker;
    const originalWindowAddEventListener = window.addEventListener.bind(window);

    let windowLoadListener: (() => void) | undefined;
    let controllerChangeListener: (() => void) | undefined;
    let register: ReturnType<typeof vi.fn>;
    let container: { controller: ServiceWorker | null };

    const installServiceWorkerMock = (opts: { controller?: ServiceWorker | null; registration?: MockRegistration } = {}) => {
        const registration = opts.registration ?? makeRegistration();
        register = vi.fn(async () => registration);
        container = {
            controller: opts.controller ?? null,
        };

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                ...container,
                get controller() { return container.controller; },
                register: register as unknown as ServiceWorkerContainer['register'],
                addEventListener: vi.fn((type: string, listener: () => void) => {
                    if (type === 'controllerchange') controllerChangeListener = listener;
                }),
            },
        });

        return registration;
    };

    const setReadyState = (state: DocumentReadyState) => {
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => state,
        });
    };

    beforeEach(() => {
        windowLoadListener = undefined;
        controllerChangeListener = undefined;
        vi.useFakeTimers();

        // Default to a page still loading so init defers to the `load` event
        // and tests can drive registration by firing the captured listener.
        setReadyState('loading');

        vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'load') {
                windowLoadListener = listener as () => void;
            } else {
                originalWindowAddEventListener(type, listener);
            }
        }) as typeof window.addEventListener);
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: originalServiceWorker,
        });
        Object.defineProperty(document, 'readyState', {
            configurable: true,
            get: () => 'complete',
        });
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('registers immediately when the document has already loaded', async () => {
        // Regression: the app's module graph can finish evaluating after the
        // `load` event has already fired. A `load` listener attached then
        // never runs, so init must register straight away instead.
        installServiceWorkerMock();
        setReadyState('complete');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        initServiceWorker();
        await flushPromises();
        await flushPromises();

        // No dependence on a future load event that will never fire.
        expect(windowLoadListener).toBeUndefined();
        expect(register).toHaveBeenCalledOnce();
    });

    it('registers the SW with a manifest-derived build id and updateViaCache none', async () => {
        installServiceWorkerMock();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        initServiceWorker();
        expect(windowLoadListener).toBeTypeOf('function');

        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        expect(register).toHaveBeenCalledOnce();
        const [url, options] = register.mock.calls[0] as [string, RegistrationOptions];
        expect(url).toMatch(/^\/sw\.js\?build=.+/);
        expect(options).toMatchObject({ updateViaCache: 'none' });
    });

    it('does not register when the manifest is unreachable', async () => {
        installServiceWorkerMock();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        expect(register).not.toHaveBeenCalled();
    });

    it('registers a new SW when a poll sees a changed manifest, once per build', async () => {
        installServiceWorkerMock();
        // A fresh Response per call: bodies are single-read.
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockImplementation(async () => new Response('{"manifest":"a"}', { status: 200 }));

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        expect(register).toHaveBeenCalledOnce();

        // Same manifest → no re-registration.
        await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL);
        expect(register).toHaveBeenCalledOnce();

        // New deploy rewrites the manifest → new registration URL.
        fetchSpy.mockImplementation(async () => new Response('{"manifest":"b"}', { status: 200 }));
        await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL);

        expect(register).toHaveBeenCalledTimes(2);
        const [firstUrl] = register.mock.calls[0] as [string];
        const [secondUrl] = register.mock.calls[1] as [string];
        expect(secondUrl).not.toBe(firstUrl);
    });

    it('announces an update when a waiting worker already exists', async () => {
        const registration = makeRegistration({
            waiting: { scriptURL: 'https://example.com/sw.js?build=new' } as ServiceWorker,
        });
        installServiceWorkerMock({
            controller: { scriptURL: 'https://example.com/sw.js?build=old' } as ServiceWorker,
            registration,
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        expect(updateHandler).toHaveBeenCalledOnce();
        const [event] = updateHandler.mock.calls[0] as [CustomEvent];
        expect(event.detail.registration).toBe(registration);
    });

    it('announces an update when a new worker reaches installed on a controlled page', async () => {
        const registration = makeRegistration();
        installServiceWorkerMock({
            controller: { scriptURL: 'https://example.com/sw.js?build=old' } as ServiceWorker,
            registration,
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        expect(updateHandler).not.toHaveBeenCalled();

        // Simulate the browser installing the newly registered worker.
        const updatefound = registration.addEventListener.mock.calls
            .find((c: unknown[]) => c[0] === 'updatefound')?.[1] as (() => void) | undefined;
        expect(updatefound).toBeTypeOf('function');

        const worker = {
            state: 'installing',
            addEventListener: vi.fn(),
        };
        registration.installing = worker as unknown as ServiceWorker;
        updatefound?.();

        const statechange = worker.addEventListener.mock.calls
            .find((c: unknown[]) => c[0] === 'statechange')?.[1] as (() => void) | undefined;
        worker.state = 'installed';
        statechange?.();

        expect(updateHandler).toHaveBeenCalledOnce();
        const [event] = updateHandler.mock.calls[0] as [CustomEvent];
        expect(event.detail.registration).toBe(registration);
    });

    it('does not announce a first-install worker on an uncontrolled page', async () => {
        const registration = makeRegistration();
        installServiceWorkerMock({ controller: null, registration });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        const updatefound = registration.addEventListener.mock.calls
            .find((c: unknown[]) => c[0] === 'updatefound')?.[1] as (() => void) | undefined;

        const worker = {
            state: 'installing',
            addEventListener: vi.fn(),
        };
        registration.installing = worker as unknown as ServiceWorker;
        updatefound?.();

        const statechange = worker.addEventListener.mock.calls
            .find((c: unknown[]) => c[0] === 'statechange')?.[1] as (() => void) | undefined;
        worker.state = 'installed';
        statechange?.();

        expect(updateHandler).not.toHaveBeenCalled();
    });

    it('ignores the controllerchange fired by the first install claim', async () => {
        installServiceWorkerMock({ controller: null });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        const reload = vi.fn();
        window.location.reload = reload;
        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        container.controller = { scriptURL: 'https://example.com/sw.js?build=a' } as ServiceWorker;
        controllerChangeListener?.();

        expect(reload).not.toHaveBeenCalled();
        expect(updateHandler).not.toHaveBeenCalled();
    });

    it('prompts (without reloading) when another tab activates a new build', async () => {
        installServiceWorkerMock({
            controller: { scriptURL: 'https://example.com/sw.js?build=old' } as ServiceWorker,
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        const reload = vi.fn();
        window.location.reload = reload;
        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        container.controller = { scriptURL: 'https://example.com/sw.js?build=new' } as ServiceWorker;
        controllerChangeListener?.();

        expect(reload).not.toHaveBeenCalled();
        expect(updateHandler).toHaveBeenCalledOnce();
        const [event] = updateHandler.mock.calls[0] as [CustomEvent];
        expect(event.detail.registration).toBeNull();
    });

    it('applyServiceWorkerUpdate activates the waiting worker and reloads on controllerchange', async () => {
        installServiceWorkerMock({
            controller: { scriptURL: 'https://example.com/sw.js?build=old' } as ServiceWorker,
        });
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"manifest":"a"}', { status: 200 }));

        const reload = vi.fn();
        window.location.reload = reload;
        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker();
        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        const waiting = { postMessage: vi.fn() };
        applyServiceWorkerUpdate({ waiting } as unknown as ServiceWorkerRegistration);

        expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
        expect(reload).not.toHaveBeenCalled();

        // The new worker activates and claims this tab → auto-reload, no prompt.
        controllerChangeListener?.();
        expect(reload).toHaveBeenCalledOnce();
        expect(updateHandler).not.toHaveBeenCalled();
    });

    it('applyServiceWorkerUpdate falls back to a plain reload without a waiting worker', () => {
        const reload = vi.fn();
        window.location.reload = reload;

        applyServiceWorkerUpdate(null);

        expect(reload).toHaveBeenCalledOnce();
    });
});
