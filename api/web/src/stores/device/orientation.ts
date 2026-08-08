import { CapgoCompass } from '@capgo/capacitor-compass';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery, normalizePermissionState } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
};

type DeviceOrientationEventWithCompass = DeviceOrientationEvent & {
    webkitCompassHeading?: number | null;
};

type DeviceOrientationEventName = 'deviceorientationabsolute' | 'deviceorientation';

export class OrientationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    hasSupport(): boolean {
        if (isNativePlatform()) return true;

        return 'DeviceOrientationEvent' in window && (
            'ondeviceorientation' in window
            || 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
        );
    }

    hasPermissionRequest(): boolean {
        if (isNativePlatform()) return false;
        if (!('DeviceOrientationEvent' in window)) return false;

        const orientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
        return typeof orientationEvent.requestPermission === 'function';
    }

    /**
     * Register a listener that fires with the compass heading (degrees clockwise
     * from true/magnetic north, 0–360) whenever the device orientation changes.
     * On native (iOS/Android) the @capgo/capacitor-compass plugin is used; on
     * web the DeviceOrientationEvent fallback is used.
     *
     * Returns an async cleanup function — call it to stop listening.
     */
    async addListener(callback: (heading: number | null) => void): Promise<() => Promise<void>> {
        if (isNativePlatform()) {
            const handle = await CapgoCompass.addListener('headingChange', (event) => {
                callback(event.value);
            });
            await CapgoCompass.startListening();
            return async () => {
                try { await CapgoCompass.stopListening(); } catch { /* ignore */ }
                try { await handle.remove(); } catch { /* ignore */ }
            };
        }

        // Web fallback — DeviceOrientationEvent
        const eventName = this.webGetEventName();
        const listener = (event: DeviceOrientationEvent): void => {
            callback(this.webGetHeading(event));
        };
        window.addEventListener(eventName, listener as EventListener);
        return async () => {
            window.removeEventListener(eventName, listener as EventListener);
        };
    }

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await CapgoCompass.checkPermissions();
                this.context.setPermissionStatus('orientation', normalizePermissionState(status.compass));
            } catch (err) {
                console.warn('Failed to check compass permission', err);
                this.context.setPermissionStatus('orientation', 'unknown');
            }
            return;
        }

        // Web fallback
        if (!this.hasSupport()) {
            this.context.setPermissionStatus('orientation', 'unsupported');
            return;
        }

        if (PermissionQuery.hasPermissionQuery()) {
            const sensorPermissions = ['accelerometer', 'gyroscope', 'magnetometer'];
            try {
                const results = await Promise.allSettled(sensorPermissions.map(async (name) => {
                    const status = await navigator.permissions.query({ name } as PermissionDescriptor);
                    return status.state;
                }));
                const states = results
                    .filter((result): result is PromiseFulfilledResult<PermissionState> => result.status === 'fulfilled')
                    .map((result) => result.value);

                if (states.includes('denied')) {
                    this.context.setPermissionStatus('orientation', 'denied');
                    return;
                }
                if (states.length === sensorPermissions.length && states.every((state) => state === 'granted')) {
                    this.context.setPermissionStatus('orientation', 'granted');
                    return;
                }
                if (states.includes('prompt')) {
                    this.context.setPermissionStatus('orientation', 'prompt');
                    return;
                }
            } catch (err) {
                console.warn('Failed to query orientation permission status', err);
            }
        }

        if (this.hasPermissionRequest()) {
            this.context.setPermissionStatus('orientation', 'prompt');
        } else {
            this.context.setPermissionStatus('orientation', 'granted');
        }
    }

    async request(): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await CapgoCompass.requestPermissions();
                this.context.setPermissionStatus('orientation', normalizePermissionState(status.compass));
            } catch (err) {
                console.warn('Failed to request compass permission', err);
            } finally {
                await this.refreshStatus();
            }
            return;
        }

        // Web fallback
        if (!this.hasSupport()) {
            this.context.setPermissionStatus('orientation', 'unsupported');
            return;
        }

        try {
            if (this.hasPermissionRequest()) {
                const orientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
                const status = await orientationEvent.requestPermission?.();
                if (status) {
                    this.context.setPermissionStatus('orientation', status);
                }
            } else {
                this.context.setPermissionStatus('orientation', 'granted');
            }
        } finally {
            await this.refreshStatus();
        }
    }

    // ─── web-only helpers ────────────────────────────────────────────────────

    private webGetEventName(): DeviceOrientationEventName {
        // On iOS (hasPermissionRequest = true), always use deviceorientation
        // which provides webkitCompassHeading for accurate absolute heading.
        // On iOS 17.4+ window.ondeviceorientationabsolute is now defined, but
        // deviceorientationabsolute fires unreliably there.
        if (this.hasPermissionRequest()) {
            return 'deviceorientation';
        }
        return 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
            ? 'deviceorientationabsolute'
            : 'deviceorientation';
    }

    private webGetHeading(event: DeviceOrientationEvent): number | null {
        const compassEvent = event as DeviceOrientationEventWithCompass;
        // webkitCompassHeading is iOS-only (degrees CW from true north).
        // It can be null when the device is flat; fall through to alpha then.
        if (typeof compassEvent.webkitCompassHeading === 'number') {
            return compassEvent.webkitCompassHeading;
        }
        return event.alpha === null ? null : 360 - event.alpha;
    }
}
