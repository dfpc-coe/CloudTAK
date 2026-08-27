import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

export function isAndroidPlatform(): boolean {
    return Capacitor.getPlatform() === 'android';
}

export function isIOSPlatform(): boolean {
    return Capacitor.getPlatform() === 'ios';
}

export function supportsServiceWorker(): boolean {
    return typeof navigator !== 'undefined' && !isNativePlatform() && 'serviceWorker' in navigator;
}

/**
 * Subscribe to foreground/background transitions. On native we use the App
 * plugin's lifecycle events because the web `visibilitychange` API is unreliable
 * inside an iOS WebView. Only a real background transition (`pause`) counts as
 * backgrounded - `appStateChange` also reports inactive for transient
 * interruptions (permission prompts, notification shade) unless
 * `includeInactive` is set. The handler receives `true` when backgrounded and
 * `false` when foregrounded, fires only on transitions, and is invoked once
 * with the current state so callers registering while already backgrounded
 * (e.g. an iOS background wake) start in sync; returns a function that removes
 * the listeners.
 */
export async function addBackgroundStateListener(
    handler: (isBackgrounded: boolean) => void,
    opts: { includeInactive?: boolean } = {}
): Promise<() => void> {
    if (isNativePlatform()) {
        let current: boolean | undefined;

        const emit = (isBackgrounded: boolean): void => {
            if (current === isBackgrounded) return;
            current = isBackgrounded;
            handler(isBackgrounded);
        };

        const listeners = await Promise.all([
            App.addListener('pause', () => emit(true)),
            App.addListener('resume', () => emit(false)),
            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive || opts.includeInactive) emit(!isActive);
            })
        ]);

        // Skip the initial fire if a transition already arrived - the sampled
        // state would be staler than what the handler has seen
        const { isActive } = await App.getState();
        if (current === undefined) emit(!isActive);

        return () => {
            for (const listener of listeners) void listener.remove();
        };
    }

    if (typeof document === 'undefined') {
        return () => { /* no-op */ };
    }

    const onVisibilityChange = (): void => { handler(document.hidden); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    handler(document.hidden);

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
        let foregrounded = false;
        let handle: { remove: () => Promise<void> } | undefined;

        // Settling requires both the foreground signal and the listener
        // handle, which arrive in either order - the callback must not close
        // over the handle promise itself, as a synchronous delivery during
        // registration would hit the temporal dead zone
        const trySettle = (): void => {
            if (settled || !foregrounded || !handle) return;
            settled = true;
            void handle.remove();
            resolve();
        };

        void App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) return;
            foregrounded = true;
            trySettle();
        }).then(async (listener) => {
            handle = listener;
            trySettle();

            // The app may have become active before the listener attached
            if (!settled && (await App.getState()).isActive) {
                foregrounded = true;
                trySettle();
            }
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
