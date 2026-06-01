import { Geolocation } from '@capacitor/geolocation';
import type { CallbackID, Position, PositionOptions } from '@capacitor/geolocation';
import { registerPlugin } from '@capacitor/core';
import type {
    BackgroundGeolocationPlugin,
    CallbackError as BackgroundGeolocationError,
    Location as BackgroundLocation
} from '@capacitor-community/background-geolocation';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    private static normalizeNativeLocationPermission(state: string | null | undefined): PermissionState | 'prompt' | 'unknown' {
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

    static supportsLocationRequests(): boolean {
        return isNativePlatform() || (typeof navigator !== 'undefined' && 'geolocation' in navigator);
    }

    static async checkNativeLocationPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
        try {
            const status = await Geolocation.checkPermissions();
            return GeolocationPermission.normalizeNativeLocationPermission(status.location ?? status.coarseLocation);
        } catch (err) {
            console.warn('Failed to query native geolocation permission status', err);
            return 'unknown';
        }
    }

    static async requestNativeLocationPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
        try {
            const status = await Geolocation.requestPermissions();
            return GeolocationPermission.normalizeNativeLocationPermission(status.location ?? status.coarseLocation);
        } catch (err) {
            console.warn('Failed to request native geolocation permission', err);
            return 'unknown';
        }
    }

    static async getCurrentLocation(options?: PositionOptions): Promise<Position> {
        return Geolocation.getCurrentPosition(options);
    }

    static async watchLocation(
        options: PositionOptions,
        callback: (position: Position | null, err?: unknown) => void
    ): Promise<CallbackID> {
        if (isNativePlatform()) {
            return BackgroundGeolocation.addWatcher({
                backgroundTitle: 'CloudTAK GPS active',
                backgroundMessage: 'CloudTAK is sharing your location.',
                requestPermissions: true,
                stale: (options.maximumAge ?? 0) > 0,
                distanceFilter: 0
            }, (location?: BackgroundLocation, err?: BackgroundGeolocationError) => {
                callback(location ? GeolocationPermission.backgroundLocationToPosition(location) : null, err);
            });
        }

        return Geolocation.watchPosition(options, callback);
    }

    static async clearLocationWatch(id: CallbackID): Promise<void> {
        if (isNativePlatform()) {
            await BackgroundGeolocation.removeWatcher({ id });
            return;
        }

        await Geolocation.clearWatch({ id });
    }

    private static backgroundLocationToPosition(location: BackgroundLocation): Position {
        return {
            timestamp: location.time ?? Date.now(),
            coords: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                altitude: location.altitude,
                altitudeAccuracy: location.altitudeAccuracy,
                speed: location.speed,
                heading: location.bearing,
                magneticHeading: null,
                trueHeading: location.bearing,
                headingAccuracy: null,
                course: location.bearing
            }
        };
    }

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            this.context.setPermissionStatus('location', await GeolocationPermission.checkNativeLocationPermission());
            return;
        } else if (!GeolocationPermission.supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('geolocation', 'Failed to query geolocation permission status');
        if (status) {
            this.context.setPermissionStatus('location', status.state);
            return;
        }

        this.context.setPermissionStatus('location', 'unknown');
    }

    async request(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await GeolocationPermission.requestNativeLocationPermission();
                this.context.setPermissionStatus('location', status);

                if (status === 'granted') {
                    onGranted?.();
                }
            } finally {
                await this.refreshStatus();
            }

            return;
        }

        if (!GeolocationPermission.supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        try {
            await GeolocationPermission.getCurrentLocation({
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
            const status = await GeolocationPermission.checkNativeLocationPermission();
            this.context.setPermissionStatus('location', status);

            if (status === 'granted') {
                onGranted?.();
            }

            return;
        }

        if ('geolocation' in navigator) {
            const status = await PermissionQuery.queryPermissionStatus('geolocation', 'Failed to subscribe to geolocation permission changes');
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
