import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

export function supportsServiceWorker(): boolean {
    return typeof navigator !== 'undefined' && !isNativePlatform() && 'serviceWorker' in navigator;
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
