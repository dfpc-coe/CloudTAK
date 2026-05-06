import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { CallbackID, Position, PositionOptions } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';

type WindowWithOrientationPermission = Window & {
    DeviceMotionEvent?: typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<PermissionState>;
    };
    DeviceOrientationEvent?: typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<PermissionState>;
    };
};

export type OrientationEventData = {
    alpha: number | null;
    webkitCompassHeading?: number;
};

function getRuntimeOrigin(): string {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    if (typeof self !== 'undefined') {
        return self.location.origin;
    }

    return 'http://localhost';
}

export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

export function supportsServiceWorker(): boolean {
    return typeof navigator !== 'undefined' && !isNativePlatform() && 'serviceWorker' in navigator;
}

export function supportsLocationRequests(): boolean {
    return isNativePlatform() || (typeof navigator !== 'undefined' && 'geolocation' in navigator);
}

export function supportsOrientationRequests(): boolean {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

function getOrientationPermissionRequest(): (() => Promise<PermissionState>) | undefined {
    if (typeof window === 'undefined') return undefined;

    const permissionWindow = window as WindowWithOrientationPermission;

    if (typeof permissionWindow.DeviceMotionEvent?.requestPermission === 'function') {
        return permissionWindow.DeviceMotionEvent.requestPermission.bind(permissionWindow.DeviceMotionEvent);
    }

    if (typeof permissionWindow.DeviceOrientationEvent?.requestPermission === 'function') {
        return permissionWindow.DeviceOrientationEvent.requestPermission.bind(permissionWindow.DeviceOrientationEvent);
    }

    return undefined;
}

export function supportsOrientationPermissionRequests(): boolean {
    return typeof getOrientationPermissionRequest() === 'function';
}

export function resolveRuntimeUrl(url: string | URL): URL {
    return url instanceof URL ? url : new URL(String(url), getRuntimeOrigin());
}

export async function openExternalUrl(url: string | URL): Promise<void> {
    const href = resolveRuntimeUrl(url).toString();

    if (isNativePlatform()) {
        await Browser.open({ url: href });
        return;
    }

    window.open(href, '_blank', 'noopener');
}

export async function openSecondaryView(url: string | URL): Promise<void> {
    const href = resolveRuntimeUrl(url);

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

export async function writeClipboardText(value: string): Promise<void> {
    await Clipboard.write({ string: value });
}

function normalizeNativePermissionState(state: string | null | undefined): PermissionState | 'prompt' | 'unknown' {
    switch (state) {
        case 'granted':
        case 'denied':
            return state;
        case 'prompt':
        case 'prompt-with-rationale':
            return 'prompt';
        default:
            return 'unknown';
    }
}

export async function checkNativeLocationPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
    try {
        const status = await Geolocation.checkPermissions();
        return normalizeNativePermissionState(status.location ?? status.coarseLocation);
    } catch (err) {
        console.warn('Failed to query native geolocation permission status', err);
        return 'unknown';
    }
}

export async function requestNativeLocationPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
    try {
        const status = await Geolocation.requestPermissions();
        return normalizeNativePermissionState(status.location ?? status.coarseLocation);
    } catch (err) {
        console.warn('Failed to request native geolocation permission', err);
        return 'unknown';
    }
}

export async function getCurrentLocation(options?: PositionOptions): Promise<Position> {
    return Geolocation.getCurrentPosition(options);
}

export async function requestOrientationPermission(): Promise<PermissionState | 'unknown'> {
    const requestPermission = getOrientationPermissionRequest();

    if (!requestPermission) {
        return 'granted';
    }

    try {
        return await requestPermission();
    } catch (err) {
        console.warn('Failed to request orientation permission', err);
        return 'unknown';
    }
}

export async function watchOrientation(
    callback: (event: OrientationEventData) => void
): Promise<PluginListenerHandle> {
    return Motion.addListener('orientation', (event) => {
        callback(event as unknown as OrientationEventData);
    });
}

export async function clearOrientationWatch(listener: PluginListenerHandle): Promise<void> {
    await listener.remove();
}

export async function watchLocation(
    options: PositionOptions,
    callback: (position: Position | null, err?: unknown) => void
): Promise<CallbackID> {
    return Geolocation.watchPosition(options, callback);
}

export async function clearLocationWatch(id: CallbackID): Promise<void> {
    await Geolocation.clearWatch({ id });
}
