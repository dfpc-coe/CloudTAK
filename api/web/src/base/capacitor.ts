import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

export function supportsServiceWorker(): boolean {
    return typeof navigator !== 'undefined' && !isNativePlatform() && 'serviceWorker' in navigator;
}

/**
 * Subscribe to foreground/background transitions. On native we use Capacitor's
 * `App.appStateChange` because the web `visibilitychange` API is unreliable
 * inside an iOS WebView. The handler receives `true` when backgrounded and
 * `false` when foregrounded; returns a function that removes the listener.
 */
export async function addBackgroundStateListener(
    handler: (isBackgrounded: boolean) => void
): Promise<() => void> {
    if (isNativePlatform()) {
        const listener = await App.addListener('appStateChange', ({ isActive }) => {
            handler(!isActive);
        });

        return () => { void listener.remove(); };
    }

    if (typeof document === 'undefined') {
        return () => { /* no-op */ };
    }

    const onVisibilityChange = (): void => { handler(document.hidden); };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); };
}

/**
 * Resolve once the app is running in the foreground. iOS can relaunch a
 * killed WebView while still backgrounded, with networking and IndexedDB
 * suspended. Resolves immediately on web.
 */
export async function whenForegrounded(): Promise<void> {
    if (!isNativePlatform()) return;

    if ((await App.getState()).isActive) return;

    await new Promise<void>((resolve) => {
        let settled = false;

        const settle = (listener: { remove: () => Promise<void> }): void => {
            if (settled) return;
            settled = true;
            void listener.remove();
            resolve();
        };

        const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) return;
            void listenerPromise.then(settle);
        });

        // The app may have become active before the listener attached
        void listenerPromise.then(async (listener) => {
            if ((await App.getState()).isActive) settle(listener);
        });
    });
}

export async function openExternalUrl(url: string | URL): Promise<void> {
    const { stdurl } = await import('../std.ts');
    const href = stdurl(url).toString();

    if (isNativePlatform()) {
        await Browser.open({ url: href });
        return;
    }

    window.open(href, '_blank', 'noopener');
}

export async function openSecondaryView(url: string | URL): Promise<void> {
    const { stdurl } = await import('../std.ts');
    const href = stdurl(url);

    if (isNativePlatform()) {
        if (typeof window !== 'undefined' && href.origin === window.location.origin) {
            window.location.assign(href.toString());
        } else {
            await Browser.open({ url: href.toString() });
        }

        return;
    }

    window.open(href.toString(), '_blank', 'noopener');
}
