interface ManifestEntry {
    file?: string;
}

const SERVICE_WORKER_BUILD_KEY = 'cloudtak-sw-build';
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
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
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
                const registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}&build=${encodeURIComponent(buildId)}`);
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
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    });
}