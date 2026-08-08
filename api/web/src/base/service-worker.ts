import { supportsServiceWorker } from './capacitor.ts';

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

function basename(value: string | null | undefined): string | null {
    if (!value) return null;

    const trimmed = value.split('?')[0];
    const name = trimmed.split('/').pop();
    return name ? decodeURIComponent(name) : null;
}

export function getCurrentEntryBuildId(): string {
    if (typeof document === 'undefined') {
        return import.meta.env.HASH;
    }

    const moduleScript = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
    const currentBuildId = basename(moduleScript?.getAttribute('src') ?? moduleScript?.src);

    return currentBuildId || import.meta.env.HASH;
}

function fingerprint(text: string): string {
    let hash = 2166136261;

    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
}

/**
 * Fingerprint the manifest bytes to identify the deployed build: every deploy
 * rewrites the manifest, so the derived SW registration URL changes and the
 * browser installs a fresh SW with a fresh precache.
 */
async function fetchDeployedBuildId(): Promise<string | null> {
    const response = await fetch('/.vite/manifest.json', { cache: 'no-store' });
    if (!response.ok) return null;

    return fingerprint(await response.text());
}

// Set when THIS tab's update banner posts SKIP_WAITING so the controllerchange
// handler auto-reloads only this tab. Other tabs see the same event without the
// flag and get a prompt instead of silently reloading (losing unsaved state).
let updateRequestedByThisTab = false;

/**
 * Called by the App.vue update banner. With a waiting worker, activate it and
 * let controllerchange reload this tab; without one (another tab already
 * activated the new build) the new cache is live, so a plain reload serves
 * the new shell.
 */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration | null): void {
    const waiting = registration?.waiting;

    if (waiting) {
        updateRequestedByThisTab = true;
        waiting.postMessage('SKIP_WAITING');
    } else {
        window.location.reload();
    }
}

function announceUpdate(registration: ServiceWorkerRegistration | null): void {
    window.dispatchEvent(new CustomEvent('sw:update-available', {
        detail: { registration }
    }));
}

function observeRegistration(registration: ServiceWorkerRegistration): void {
    console.log('[SW] registration observed', {
        scope: registration.scope,
        installing: registration.installing?.state ?? null,
        waiting: registration.waiting?.state ?? null,
        active: registration.active?.state ?? null,
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
        console.log('[SW] waiting worker already present on load — announcing update');
        announceUpdate(registration);
    }

    registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        console.log('[SW] updatefound — installing worker state:', worker?.state ?? 'none');
        if (!worker) return;

        worker.addEventListener('statechange', () => {
            console.log('[SW] installing worker statechange →', worker.state);
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] new worker installed while page is controlled — announcing update');
                announceUpdate(registration);
            }
        });
    });
}

export function initServiceWorker(): void {
    if (import.meta.env.DEV) {
        console.info('[SW] registration skipped: dev mode (service worker is production-only)');
        return;
    }

    if (!supportsServiceWorker()) {
        console.info('[SW] registration skipped: unsupported environment (native platform or no serviceWorker API)');
        return;
    }

    const start = () => {
        console.log('[SW] starting registration — controller:', navigator.serviceWorker.controller?.scriptURL ?? 'none');

        let registeredBuildId: string | null = null;

        const register = async (buildId: string) => {
            if (buildId === registeredBuildId) {
                console.debug(`[SW] build ${buildId} already registered — skipping`);
                return;
            }
            registeredBuildId = buildId;

            const scriptUrl = `/sw.js?build=${encodeURIComponent(buildId)}`;
            try {
                console.log(`[SW] registering ${scriptUrl}`);
                // `updateViaCache: 'none'` keeps the sw.js script itself out of
                // the HTTP cache, so a stale intermediary can't pin users to an
                // old service worker.
                const registration = await navigator.serviceWorker.register(
                    scriptUrl,
                    { updateViaCache: 'none' }
                );

                console.log('[SW] register() resolved');
                observeRegistration(registration);
            } catch (err) {
                registeredBuildId = null;
                console.error('[SW] registration failed:', err);
            }
        };

        // Register the current deploy, then poll so long-lived tabs pick up new
        // deploys. If the manifest is unreachable (offline start), the existing
        // registration keeps serving until the next successful poll.
        const checkDeployedBuild = async () => {
            try {
                const buildId = await fetchDeployedBuildId();
                if (buildId) {
                    await register(buildId);
                } else {
                    console.warn('[SW] could not resolve deployed build id (manifest unreachable or non-OK)');
                }
            } catch (err) {
                console.debug('[SW] failed to check deployed frontend build:', err);
            }
        };

        void checkDeployedBuild();
        window.setInterval(checkDeployedBuild, UPDATE_CHECK_INTERVAL);

        // `clients.claim()` on first install also fires controllerchange;
        // only a change away from an existing controller means another tab
        // activated a new build.
        let wasControlled = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] controllerchange — new controller:', navigator.serviceWorker.controller?.scriptURL ?? 'none');

            if (updateRequestedByThisTab) {
                updateRequestedByThisTab = false;
                console.log('[SW] controllerchange requested by this tab — reloading');
                window.location.reload();
                return;
            }

            if (!wasControlled) {
                console.log('[SW] controllerchange from first-install claim — ignoring');
                wasControlled = true;
                return;
            }

            console.log('[SW] another tab activated a new build — announcing update');
            announceUpdate(null);
        });
    };

    // Defer registration until load so it doesn't compete with critical
    // resources, but check `readyState` first: if the module graph evaluates
    // after `load` has already fired, a `load` listener would never run.
    if (document.readyState === 'complete') {
        console.log('[SW] init — document already loaded, registering immediately');
        start();
    } else {
        console.log('[SW] init — awaiting window load event');
        window.addEventListener('load', start, { once: true });
    }
}
