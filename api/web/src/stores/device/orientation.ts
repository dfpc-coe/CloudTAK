import { PermissionQuery } from './shared.ts';
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
        return 'DeviceOrientationEvent' in window && (
            'ondeviceorientation' in window
            || 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
        );
    }

    hasPermissionRequest(): boolean {
        if (!('DeviceOrientationEvent' in window)) return false;

        const orientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
        return typeof orientationEvent.requestPermission === 'function';
    }

    getEventName(): DeviceOrientationEventName {
        // On iOS, DeviceOrientationEvent.requestPermission() exists (Apple-only
        // API). iOS 17.4+ also added window.ondeviceorientationabsolute, which
        // makes the generic 'absolute' check below return true — but
        // deviceorientationabsolute fires unreliably on iOS.  The correct iOS
        // source is deviceorientation + webkitCompassHeading, so we pin to that
        // event whenever we're in an iOS/Safari context.
        if (this.hasPermissionRequest()) {
            return 'deviceorientation';
        }

        return 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
            ? 'deviceorientationabsolute'
            : 'deviceorientation';
    }

    getHeading(event: DeviceOrientationEvent): number | null {
        const compassEvent = event as DeviceOrientationEventWithCompass;

        // webkitCompassHeading is an iOS-only property that gives degrees
        // clockwise from true north directly.  It can be null when the device
        // is lying flat or the compass is temporarily unavailable; in that case
        // fall through to the alpha-based calculation below.
        if (typeof compassEvent.webkitCompassHeading === 'number') {
            return compassEvent.webkitCompassHeading;
        }

        return event.alpha === null ? null : 360 - event.alpha;
    }

    addListener(listener: (event: DeviceOrientationEvent) => void): void {
        window.addEventListener(this.getEventName(), listener as EventListener);
    }

    removeListener(listener: (event: DeviceOrientationEvent) => void): void {
        window.removeEventListener(this.getEventName(), listener as EventListener);
    }

    async refreshStatus(): Promise<void> {
        if (!this.hasSupport()) {
            this.context.setPermissionStatus('orientation', 'unsupported');
            return;
        }

        if (PermissionQuery.hasPermissionQuery()) {
            const sensorPermissions = [
                'accelerometer',
                'gyroscope',
                'magnetometer'
            ];

            try {
                const results = await Promise.allSettled(sensorPermissions.map(async (name) => {
                    const status = await navigator.permissions.query({
                        name
                    } as PermissionDescriptor);

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
}
