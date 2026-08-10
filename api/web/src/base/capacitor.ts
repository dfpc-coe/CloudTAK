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

/*
 * The iOS keyboard plugin runs in its default `resize: native` mode, shrinking
 * the WKWebView frame by the keyboard height. The shrink is deferred by the
 * keyboard animation duration + 0.2s, and the ONLY thing that both cancels a
 * pending shrink and clears the stored height is a UIKeyboardWillHide
 * notification - which iOS posts when a first responder resigns cleanly.
 *
 * Destroying the focused input instead never produces one. The deferred shrink
 * then lands ~450ms later on a screen that no longer has a keyboard, and there
 * is no path that ever undoes it: the WebView is the view controller's root
 * view, so the vacated strip is the bare black UIWindow.
 *
 * So resign the responder before the input can be unmounted. It must be a
 * synchronous blur() and NOT Keyboard.hide() - that call crosses the Capacitor
 * bridge asynchronously, and its `endEditing:` can easily land after the input
 * is already gone, which is the very case being defended against.
 *
 * Nothing needs to be awaited. Once the notification is posted the plugin
 * restores the frame on the native runloop, unaffected by anything JS does
 * next - including a full document navigation.
 */
export function blurActiveInput(): void {
    if (typeof document === 'undefined') return;

    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
        active.blur();
    }
}

/**
 * Subscribe to foreground/background transitions. On native we use Capacitor's
 * `App.appStateChange` because the web `visibilitychange` API is unreliable
 * inside an iOS WebView. The handler receives `true` when backgrounded and
 * `false` when foregrounded, and is invoked once with the current state so
 * callers registering while already backgrounded (e.g. an iOS background
 * wake) start in sync; returns a function that removes the listener.
 */
export async function addBackgroundStateListener(
    handler: (isBackgrounded: boolean) => void
): Promise<() => void> {
    if (isNativePlatform()) {
        let sawEvent = false;

        const listener = await App.addListener('appStateChange', ({ isActive }) => {
            sawEvent = true;
            handler(!isActive);
        });

        // Skip the initial fire if a transition already arrived - the sampled
        // state would be staler than what the handler has seen
        const { isActive } = await App.getState();
        if (!sawEvent) handler(!isActive);

        return () => { void listener.remove(); };
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
