import { hasPermissionQuery } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
};

type DeviceOrientationEventWithCompass = DeviceOrientationEvent & {
    webkitCompassHeading?: number;
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
        return 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
            ? 'deviceorientationabsolute'
            : 'deviceorientation';
    }

    getHeading(event: DeviceOrientationEvent): number | null {
        const compassEvent = event as DeviceOrientationEventWithCompass;

        if (compassEvent.webkitCompassHeading !== undefined) {
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

        if (hasPermissionQuery()) {
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