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
 * The deployed build is identified by fingerprinting the manifest bytes: any
 * deploy rewrites the manifest, and the SW registration URL derives from it,
 * so a new deploy always produces a new registration URL — which is what
 * triggers the browser to install a fresh SW with a fresh precache.
 */
async function fetchDeployedBuildId(): Promise<string | null> {
    const response = await fetch('/.vite/manifest.json', { cache: 'no-store' });
    if (!response.ok) return null;

    return fingerprint(await response.text());
}

// Set when THIS tab's update banner posts SKIP_WAITING, so the
// controllerchange handler knows it is safe to auto-reload. Other tabs see
// the same controllerchange without the flag and get a prompt instead of
// silently reloading (which would lose unsaved state). A module variable
// suffices: the flag is set and consumed within one page lifetime.
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
    if (registration.waiting && navigator.serviceWorker.controller) {
        announceUpdate(registration);
    }

    registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                announceUpdate(registration);
            }
        });
    });
}

export function initServiceWorker(): void {
    if (import.meta.env.DEV || !supportsServiceWorker()) {
        return;
    }

    window.addEventListener('load', () => {
        let registeredBuildId: string | null = null;

        const register = async (buildId: string) => {
            if (buildId === registeredBuildId) return;
            registeredBuildId = buildId;

            try {
                // `updateViaCache: 'none'` ensures the sw.js script itself
                // is never served from HTTP cache. Without this, a stale
                // intermediary could pin users to an old service worker
                // indefinitely.
                const registration = await navigator.serviceWorker.register(
                    `/sw.js?build=${encodeURIComponent(buildId)}`,
                    { updateViaCache: 'none' }
                );

                observeRegistration(registration);
            } catch (err) {
                registeredBuildId = null;
                console.error('ServiceWorker registration failed:', err);
            }
        };

        // Register against whatever is deployed right now, then poll so
        // long-lived tabs pick up new deploys. If the manifest is
        // unreachable (offline start), the existing registration keeps
        // serving and the next successful poll registers the current build.
        const checkDeployedBuild = async () => {
            try {
                const buildId = await fetchDeployedBuildId();
                if (buildId) await register(buildId);
            } catch (err) {
                console.debug('Failed to check deployed frontend build:', err);
            }
        };

        void checkDeployedBuild();
        window.setInterval(checkDeployedBuild, UPDATE_CHECK_INTERVAL);

        // `clients.claim()` on first install also fires controllerchange;
        // only a change away from an existing controller means another tab
        // activated a new build.
        let wasControlled = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (updateRequestedByThisTab) {
                updateRequestedByThisTab = false;
                window.location.reload();
                return;
            }

            if (!wasControlled) {
                wasControlled = true;
                return;
            }

            announceUpdate(null);
        });
    });
}
