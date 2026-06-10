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
 * Subscribe to foreground/background transitions in a way that is reliable on
 * native platforms. On native we use Capacitor's `App.appStateChange`, which
 * fires accurately when the app is suspended/resumed by the OS — unlike the web
 * `document.hidden`/`visibilitychange` API, which is unreliable inside an iOS
 * WebView. On web we fall back to the Page Visibility API.
 *
 * The handler is invoked with `true` when the app is backgrounded and `false`
 * when it returns to the foreground. Returns a function that removes the
 * listener.
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
