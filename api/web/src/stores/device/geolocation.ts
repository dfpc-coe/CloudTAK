import { Geolocation } from '@capacitor/geolocation';
import type { CallbackID, Position, PositionOptions } from '@capacitor/geolocation';
import { isNativePlatform } from '../../base/capacitor.ts';
import { queryPermissionStatus } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

function normalizeNativeLocationPermission(state: string | null | undefined): PermissionState | 'prompt' | 'unknown' {
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

export function supportsLocationRequests(): boolean {
    return isNativePlatform() || (typeof navigator !== 'undefined' && 'geolocation' in navigator);
}

export async function checkNativeLocationPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
    try {
        const status = await Geolocation.checkPermissions();
        return normalizeNativeLocationPermission(status.location ?? status.coarseLocation);
    } catch (err) {
        console.warn('Failed to query native geolocation permission status', err);
        return 'unknown';
    }
}

export async function requestNativeLocationPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
    try {
        const status = await Geolocation.requestPermissions();
        return normalizeNativeLocationPermission(status.location ?? status.coarseLocation);
    } catch (err) {
        console.warn('Failed to request native geolocation permission', err);
        return 'unknown';
    }
}

export async function getCurrentLocation(options?: PositionOptions): Promise<Position> {
    return Geolocation.getCurrentPosition(options);
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

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            this.context.setPermissionStatus('location', await checkNativeLocationPermission());
            return;
        }

        if (!supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        const status = await queryPermissionStatus('geolocation', 'Failed to query geolocation permission status');
        if (status) {
            this.context.setPermissionStatus('location', status.state);
            return;
        }

        this.context.setPermissionStatus('location', 'unknown');
    }

    async request(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await requestNativeLocationPermission();
                this.context.setPermissionStatus('location', status);

                if (status === 'granted') {
                    onGranted?.();
                }
            } finally {
                await this.refreshStatus();
            }

            return;
        }

        if (!supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        try {
            await getCurrentLocation({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });

            onGranted?.();
        } finally {
            await this.refreshStatus();
        }
    }

    async initializeSubscription(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            const status = await checkNativeLocationPermission();
            this.context.setPermissionStatus('location', status);

            if (status === 'granted') {
                onGranted?.();
            }

            return;
        }

        if ('geolocation' in navigator) {
            const status = await queryPermissionStatus('geolocation', 'Failed to subscribe to geolocation permission changes');
            if (status) {
                this.context.setPermissionStatus('location', status.state);
                status.onchange = () => {
                    this.context.setPermissionStatus('location', status.state);

                    if (status.state === 'granted') {
                        onGranted?.();
                    }
                };
            }

            return;
        }

        console.error('Browser does not appear to support Geolocation');
        this.context.setPermissionStatus('location', 'unsupported');
    }
}