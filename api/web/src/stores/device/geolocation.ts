import { Geolocation } from '@capacitor/geolocation';
import type { Position } from '@capacitor/geolocation';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import type {
    CallbackError as BackgroundGeolocationError,
    Location as BackgroundLocation
} from '@capgo/background-geolocation';
import { isNativePlatform } from '../../utils/capacitor.ts';
import { PermissionQuery, normalizePermissionState } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    private watchActive = false;
    private locationCallback: ((position: Position) => void) | null = null;

    static supportsLocationRequests(): boolean {
        return isNativePlatform() || (typeof navigator !== 'undefined' && 'geolocation' in navigator);
    }

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await Geolocation.checkPermissions();
                this.context.setPermissionStatus('location', normalizePermissionState(status.location ?? status.coarseLocation));
            } catch (err) {
                console.warn('Failed to query native geolocation permission status', err);
                this.context.setPermissionStatus('location', 'unknown');
            }
            return;
        }

        if (!GeolocationPermission.supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('geolocation', 'Failed to query geolocation permission status');
        this.context.setPermissionStatus('location', status ? status.state : 'unknown');
    }

    async request(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await Geolocation.requestPermissions();
                const state = normalizePermissionState(status.location ?? status.coarseLocation);
                this.context.setPermissionStatus('location', state);
                if (state === 'granted') onGranted?.();
            } catch (err) {
                console.warn('Failed to request native geolocation permission', err);
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
            await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            onGranted?.();
        } finally {
            await this.refreshStatus();
        }
    }

    async initializeSubscription(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            await this.refreshStatus();
            if (this.context.permissions.location === 'granted') onGranted?.();
            return;
        }

        if (!('geolocation' in navigator)) {
            console.error('Browser does not appear to support Geolocation');
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('geolocation', 'Failed to subscribe to geolocation permission changes');
        if (status) {
            this.context.setPermissionStatus('location', status.state);
            status.onchange = () => {
                this.context.setPermissionStatus('location', status.state);
                if (status.state === 'granted') onGranted?.();
            };
        }
    }

    async startWatch(onLocation: (position: Position) => void): Promise<void> {
        if (!GeolocationPermission.supportsLocationRequests()) return;
        await this.stopWatch();

        this.locationCallback = onLocation;

        const handler = (position: Position | null, err?: unknown) => {
            if (err) {
                console.error('Location Error', err);
                return;
            }
            if (position && this.locationCallback) this.locationCallback(position);
        };

        try {
            // Resolve the foreground (When In Use) prompt before starting the
            // watcher: iOS ignores the watcher's escalation to "Always" while
            // that first prompt is still pending, which used to defer the
            // Always prompt to the second app launch.
            if (isNativePlatform()) {
                await this.refreshStatus();
                if (this.context.permissions.location === 'prompt') {
                    await this.request();
                }
            }

            // Single watcher on every platform: on native the plugin delivers
            // foreground fixes too, and on web it falls back to
            // navigator.geolocation.watchPosition.
            await this.startBackgroundWatch(handler);
        } catch (err) {
            console.error('Failed to start location watch', err);
        }
    }

    async stopWatch(): Promise<void> {
        if (this.watchActive) {
            this.watchActive = false;
            try {
                await BackgroundGeolocation.stop();
            } catch (err) {
                console.warn('Failed to clear location watch', err);
            }
        }

        this.locationCallback = null;
    }

    private async startBackgroundWatch(handler: (position: Position | null, err?: unknown) => void): Promise<void> {
        await BackgroundGeolocation.start({
            backgroundTitle: 'CloudTAK GPS active',
            backgroundMessage: 'CloudTAK is sharing your location.',
            requestPermissions: true,
            stale: false,
            // Metres of movement before a new fix is delivered. 0 disables
            // filtering (kCLDistanceFilterNone on iOS) and streams fixes
            // continuously, keeping the GPS radio hot even when stationary.
            // Ignored by the web fallback.
            distanceFilter: 10
        }, (location?: BackgroundLocation, err?: BackgroundGeolocationError) => {
            handler(location ? GeolocationPermission.backgroundLocationToPosition(location) : null, err);
        });
        this.watchActive = true;
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
}
