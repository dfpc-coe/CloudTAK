import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { initServiceWorker } from './service-worker.ts';

function flushPromises(): Promise<void> {
    return Promise.resolve().then(() => undefined);
}

describe('service-worker registration lifecycle', () => {
    const originalServiceWorker = navigator.serviceWorker;
    const originalVisibilityState = document.visibilityState;
    const originalWindowAddEventListener = window.addEventListener.bind(window);
    const originalDocumentAddEventListener = document.addEventListener.bind(document);

    let controllerChangeListener: (() => void) | undefined;
    let updateFoundListener: (() => void) | undefined;
    let windowLoadListener: (() => void) | undefined;
    let windowFocusListener: (() => void) | undefined;
    let visibilityChangeListener: (() => void) | undefined;

    beforeEach(() => {
        controllerChangeListener = undefined;
        updateFoundListener = undefined;
        windowLoadListener = undefined;
        windowFocusListener = undefined;
        visibilityChangeListener = undefined;
        sessionStorage.clear();

        vi.spyOn(window, 'setInterval').mockImplementation(() => 1 as unknown as number);
        vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'load') windowLoadListener = listener as () => void;
            if (type === 'focus') windowFocusListener = listener as () => void;
            if (type !== 'load' && type !== 'focus') {
                originalWindowAddEventListener(type, listener);
            }
        }) as typeof window.addEventListener);
        vi.spyOn(document, 'addEventListener').mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'visibilitychange') visibilityChangeListener = listener as () => void;
            if (type !== 'visibilitychange') {
                originalDocumentAddEventListener(type, listener);
            }
        }) as typeof document.addEventListener);
        vi.spyOn(window, 'dispatchEvent');

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: originalVisibilityState,
        });
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: originalServiceWorker,
        });
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: originalVisibilityState,
        });
        vi.restoreAllMocks();
    });

    it('does not raise an update prompt on first controller claim', async () => {
        const registration = {
            scope: '/',
            waiting: null,
            installing: null,
            active: null,
            addEventListener: vi.fn((type: string, listener: () => void) => {
                if (type === 'updatefound') updateFoundListener = listener;
            }),
        } as unknown as ServiceWorkerRegistration;

        const register = vi.fn(async (url: string) => {
            (navigator.serviceWorker as ServiceWorkerContainer & { controller: ServiceWorker | null }).controller = {
                scriptURL: `https://example.com${url}`,
            } as ServiceWorker;
            return registration;
        });

        const getRegistration = vi.fn(async () => null);

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                controller: null,
                register,
                getRegistration,
                addEventListener: vi.fn((type: string, listener: () => void) => {
                    if (type === 'controllerchange') controllerChangeListener = listener;
                }),
            } satisfies Partial<ServiceWorkerContainer>,
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
        const reload = vi.fn();
        window.location.reload = reload;
        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker('12.130.0');
        expect(windowLoadListener).toBeTypeOf('function');

        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        expect(register).toHaveBeenCalledOnce();
        expect(controllerChangeListener).toBeTypeOf('function');

        controllerChangeListener?.();

        expect(reload).not.toHaveBeenCalled();
        expect(updateHandler).not.toHaveBeenCalled();
    });

    it('raises an update prompt when another tab activates a different build', async () => {
        const activeWorker = {
            scriptURL: 'https://example.com/sw.js?v=12.129.0&build=old-build',
        } as ServiceWorker;

        const registration = {
            scope: '/',
            waiting: null,
            installing: null,
            active: activeWorker,
            addEventListener: vi.fn(),
        } as unknown as ServiceWorkerRegistration;

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                controller: activeWorker,
                register: vi.fn(),
                getRegistration: vi.fn(async () => registration),
                addEventListener: vi.fn((type: string, listener: () => void) => {
                    if (type === 'controllerchange') controllerChangeListener = listener;
                }),
            } satisfies Partial<ServiceWorkerContainer>,
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
        const updateHandler = vi.fn();
        window.addEventListener('sw:update-available', updateHandler);

        initServiceWorker('12.130.0');
        expect(windowLoadListener).toBeTypeOf('function');

        windowLoadListener?.();
        await flushPromises();
        await flushPromises();

        (navigator.serviceWorker as ServiceWorkerContainer & { controller: ServiceWorker }).controller = {
            scriptURL: 'https://example.com/sw.js?v=12.130.0&build=new-build',
        } as ServiceWorker;

        controllerChangeListener?.();

        expect(updateHandler).toHaveBeenCalledOnce();

        const [event] = updateHandler.mock.calls[0] as [CustomEvent];
        expect(event.detail).toMatchObject({
            version: '12.130.0',
            build: 'new-build',
            activated: true,
            registration: null,
        });
        expect(sessionStorage.getItem('cloudtak-sw-build')).toBe('new-build');
        expect(windowFocusListener).toBeTypeOf('function');
        expect(visibilityChangeListener).toBeTypeOf('function');
    });
});