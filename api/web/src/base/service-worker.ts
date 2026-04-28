import { supportsServiceWorker } from './capacitor.ts';

interface ManifestEntry {
    file?: string;
}

const SERVICE_WORKER_BUILD_KEY = 'cloudtak-sw-build';
const UPDATE_REQUESTED_KEY = 'cloudtak-sw-update-requested';
const SERVICE_WORKER_ENTRIES = [
    'admin.html',
    'connection.html',
    'docs.html',
    'index.html',
    'video.html'
] as const;

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

function fingerprintBuild(parts: string[]): string {
    let hash = 2166136261;

    for (const part of parts.toSorted()) {
        for (let index = 0; index < part.length; index++) {
            hash ^= part.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
    }

    return (hash >>> 0).toString(36);
}

function getDeploymentBuildId(manifest: Record<string, ManifestEntry>): string | null {
    const entryFiles = SERVICE_WORKER_ENTRIES
        .map((entry) => basename(manifest[entry]?.file))
        .filter((entry): entry is string => Boolean(entry));

    if (!entryFiles.length) {
        return null;
    }

    return fingerprintBuild(entryFiles);
}

function getWorkerBuildId(worker?: ServiceWorker | null): string | null {
    if (!worker?.scriptURL) {
        return null;
    }

    return new URL(worker.scriptURL).searchParams.get('build');
}

function getPageBuildId(registration?: ServiceWorkerRegistration | null): string | null {
    return getWorkerBuildId(navigator.serviceWorker.controller)
        ?? getWorkerBuildId(registration?.active)
        ?? getPageServiceWorkerBuildId();
}

function getRegistrationBuildId(registration?: ServiceWorkerRegistration | null): string | null {
    return getWorkerBuildId(registration?.waiting)
        ?? getWorkerBuildId(registration?.installing)
        ?? getPageBuildId(registration);
}

export function getPageServiceWorkerBuildId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.sessionStorage.getItem(SERVICE_WORKER_BUILD_KEY);
}

/**
 * Called by the update banner in App.vue immediately before it posts
 * `SKIP_WAITING` to the waiting worker. Sets a per-tab flag so that when
 * `controllerchange` fires we know *this* tab asked for the reload and
 * it is safe to auto-refresh. Other tabs on the same origin observe the
 * same `controllerchange` but will show their own update prompt instead
 * of silently reloading (which would lose unsaved state).
 */
export function markUpdateRequestedByThisTab(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(UPDATE_REQUESTED_KEY, '1');
}

function consumeLocalUpdateRequest(): boolean {
    if (typeof window === 'undefined') return false;
    const value = window.sessionStorage.getItem(UPDATE_REQUESTED_KEY);
    if (!value) return false;
    window.sessionStorage.removeItem(UPDATE_REQUESTED_KEY);
    return true;
}

function setPageServiceWorkerBuildId(buildId: string): void {
    window.sessionStorage.setItem(SERVICE_WORKER_BUILD_KEY, buildId);
}

async function fetchDeployedBuildId(): Promise<string | null> {
    const response = await fetch(`/.vite/manifest.json?ts=${Date.now()}`, {
        cache: 'no-store'
    });

    if (!response.ok) {
        return null;
    }

    const manifest = await response.json() as Record<string, ManifestEntry>;
    return getDeploymentBuildId(manifest);
}

function notifyWaitingWorker(registration: ServiceWorkerRegistration, worker: ServiceWorker, lastNotifiedWorker: { url: string | null }) {
    if (!worker.scriptURL || lastNotifiedWorker.url === worker.scriptURL) {
        return;
    }

    lastNotifiedWorker.url = worker.scriptURL;

    const url = new URL(worker.scriptURL);
    window.dispatchEvent(new CustomEvent('sw:update-available', {
        detail: {
            version: url.searchParams.get('v'),
            build: url.searchParams.get('build'),
            registration
        }
    }));
}

function observeRegistration(registration: ServiceWorkerRegistration, lastNotifiedWorker: { url: string | null }) {
    if (registration.waiting) {
        notifyWaitingWorker(registration, registration.waiting, lastNotifiedWorker);
    }

    registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                notifyWaitingWorker(registration, newWorker, lastNotifiedWorker);
            }
        });
    });
}

export function initServiceWorker(version: string): void {
    if (import.meta.env.DEV || !supportsServiceWorker()) {
        return;
    }

    window.addEventListener('load', () => {
        const lastNotifiedWorker = { url: null as string | null };
        let refreshing = false;
        let requestedBuildId: string | null = null;
        let currentBuildId = getPageServiceWorkerBuildId();

        const register = async (buildId: string, options?: { syncPageBuild?: boolean }) => {
            if (requestedBuildId === buildId) {
                return;
            }

            requestedBuildId = buildId;

            try {
                // `updateViaCache: 'none'` ensures the sw.js script itself
                // is never served from HTTP cache. Without this, a stale
                // intermediary could pin users to an old service worker
                // indefinitely.
                const registration = await navigator.serviceWorker.register(
                    `/sw.js?v=${encodeURIComponent(version)}&build=${encodeURIComponent(buildId)}`,
                    { updateViaCache: 'none' }
                );
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                observeRegistration(registration, lastNotifiedWorker);

                if (options?.syncPageBuild) {
                    currentBuildId = buildId;
                    setPageServiceWorkerBuildId(buildId);
                }
            } catch (err) {
                requestedBuildId = null;
                console.log('ServiceWorker registration failed: ', err);
            }
        };

        const checkForDeployedBuild = async () => {
            try {
                const deployedBuildId = await fetchDeployedBuildId();

                if (!deployedBuildId || deployedBuildId === currentBuildId || deployedBuildId === requestedBuildId) {
                    return;
                }

                await register(deployedBuildId);
            } catch (err) {
                console.debug('Failed to check deployed frontend build:', err);
            }
        };

        const initialize = async () => {
            try {
                const existingRegistration = await navigator.serviceWorker.getRegistration();
                const existingBuildId = getRegistrationBuildId(existingRegistration);

                if (existingRegistration) {
                    observeRegistration(existingRegistration, lastNotifiedWorker);
                }

                const pageBuildId = getPageBuildId(existingRegistration);

                if (pageBuildId) {
                    currentBuildId = pageBuildId;
                    setPageServiceWorkerBuildId(pageBuildId);
                }

                if (existingBuildId) {
                    requestedBuildId = existingBuildId;
                }

                const deployedBuildId = await fetchDeployedBuildId() ?? currentBuildId ?? import.meta.env.HASH;

                if (!currentBuildId) {
                    await register(deployedBuildId, { syncPageBuild: true });
                } else if (deployedBuildId !== currentBuildId) {
                    await register(deployedBuildId);
                }
            } catch (err) {
                console.debug('Failed to initialize ServiceWorker registration:', err);
            }
        };

        void initialize();

        window.addEventListener('focus', () => {
            void checkForDeployedBuild();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void checkForDeployedBuild();
            }
        });

        window.setInterval(() => {
            void checkForDeployedBuild();
        }, 30000);

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;

            const localUpdateRequested = consumeLocalUpdateRequest();

            const controller = navigator.serviceWorker.controller;
            const url = controller?.scriptURL ? new URL(controller.scriptURL) : null;
            const activatedBuildId = url?.searchParams.get('build') ?? null;

            // Persist the activated build id BEFORE any reload so that the
            // next page load sees a matching `currentBuildId` and does not
            // re-trigger the update banner. Without this, App.vue's mount-
            // time check compares the freshly-loaded page (new build) to a
            // stale sessionStorage value and mistakenly surfaces the prompt
            // again until the user manually refreshes a second time.
            if (activatedBuildId) {
                setPageServiceWorkerBuildId(activatedBuildId);
            }

            // Only auto-reload if this tab is the one that clicked "Update
            // Now". Other tabs observe the same controllerchange; silently
            // reloading them would drop in-progress form data and map
            // selections, so we surface an update prompt instead and let
            // the user choose when to reload.
            if (localUpdateRequested) {
                refreshing = true;
                window.location.reload();
                return;
            }

            if (!url) return;

            // `clients.claim()` on the first install also triggers
            // controllerchange. Only surface an update prompt when the newly
            // activated worker differs from the build this page was already
            // running.
            if (!currentBuildId || !activatedBuildId || activatedBuildId === currentBuildId) {
                if (activatedBuildId) {
                    currentBuildId = activatedBuildId;
                }
                return;
            }

            currentBuildId = activatedBuildId;

            window.dispatchEvent(new CustomEvent('sw:update-available', {
                detail: {
                    version: url.searchParams.get('v'),
                    build: activatedBuildId,
                    registration: null,
                    activated: true,
                }
            }));
        });
    });
}