interface ManifestEntry {
    file?: string;
}

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

async function fetchDeployedBuildId(entry: string): Promise<string | null> {
    const response = await fetch(`/.vite/manifest.json?ts=${Date.now()}`, {
        cache: 'no-store'
    });

    if (!response.ok) {
        return null;
    }

    const manifest = await response.json() as Record<string, ManifestEntry>;
    return basename(manifest[entry]?.file);
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

export function initServiceWorker(version: string, entry: string): void {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        const currentBuildId = getCurrentEntryBuildId();
        const lastNotifiedWorker = { url: null as string | null };
        let refreshing = false;
        let requestedBuildId: string | null = null;

        const register = async (buildId: string) => {
            if (requestedBuildId === buildId) {
                return;
            }

            requestedBuildId = buildId;

            try {
                const registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}&build=${encodeURIComponent(buildId)}`);
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                observeRegistration(registration, lastNotifiedWorker);
            } catch (err) {
                requestedBuildId = null;
                console.log('ServiceWorker registration failed: ', err);
            }
        };

        const checkForDeployedBuild = async () => {
            try {
                const deployedBuildId = await fetchDeployedBuildId(entry);

                if (!deployedBuildId || deployedBuildId === currentBuildId || deployedBuildId === requestedBuildId) {
                    return;
                }

                await register(deployedBuildId);
            } catch (err) {
                console.debug('Failed to check deployed frontend build:', err);
            }
        };

        void register(currentBuildId);
        void checkForDeployedBuild();

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