import { Geolocation } from '@capacitor/geolocation';
import type { CallbackID, Position, PositionOptions } from '@capacitor/geolocation';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import type {
    CallbackError as BackgroundGeolocationError,
    Location as BackgroundLocation
} from '@capgo/background-geolocation';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    private watchId: CallbackID | null = null;
    private backgroundWatchActive: boolean = false;
    private locationCallback: ((position: Position) => void) | null = null;

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
        // Use standard geolocation for foreground (more reliable on iOS)
        return Geolocation.watchPosition(options, callback);
    }

    static async startBackgroundLocation(
        callback: (position: Position | null, err?: unknown) => void
    ): Promise<void> {
        // Background-capable watcher. Runs alongside the foreground watcher and
        // is the source that keeps delivering once iOS suspends the JS-based
        // foreground watchPosition in the background.
        await BackgroundGeolocation.start({
            backgroundTitle: 'CloudTAK GPS active',
            backgroundMessage: 'CloudTAK is sharing your location.',
            requestPermissions: true,
            stale: false,
            distanceFilter: 0
        }, (location?: BackgroundLocation, err?: BackgroundGeolocationError) => {
            callback(location ? GeolocationPermission.backgroundLocationToPosition(location) : null, err);
        });
    }

    static async clearLocationWatch(id: CallbackID): Promise<void> {
        await Geolocation.clearWatch({ id });
    }

    static async stopBackgroundLocation(): Promise<void> {
        await BackgroundGeolocation.stop();
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

    async stopWatch(): Promise<void> {
        // Stop foreground watch
        if (this.watchId !== null) {
            const id = this.watchId;
            this.watchId = null;
            try {
                await GeolocationPermission.clearLocationWatch(id);
            } catch (err) {
                console.warn('Failed to clear location watch', err);
            }
        }
        
        // Stop background watch
        if (this.backgroundWatchActive) {
            this.backgroundWatchActive = false;
            try {
                await GeolocationPermission.stopBackgroundLocation();
            } catch (err) {
                console.warn('Failed to clear background location watch', err);
            }
        }

        this.locationCallback = null;
    }

    async startWatch(onLocation: (position: Position) => void): Promise<void> {
        if (!GeolocationPermission.supportsLocationRequests()) return;
        await this.stopWatch();
        
        this.locationCallback = onLocation;
        
        const locationHandler = (position: Position | null, err?: unknown) => {
            if (err) {
                console.error('Location Error', err);
                return;
            }
            if (position && this.locationCallback) {
                this.locationCallback(position);
            }
        };

        try {
            if (isNativePlatform()) {
                // Start the foreground watcher first. @capacitor/geolocation's
                // watchPosition delivers an immediate, reliable fix on iOS
                // (including the simulator), which is what clears the initial
                // "Acquiring GPS" state. The background-capable watcher is then
                // started concurrently so location keeps flowing once the app is
                // suspended — iOS suspends the foreground watchPosition in the
                // background while @capgo/background-geolocation
                // continues. Reporting still branches on foreground vs.
                // background in the location callback (Option B): the worker
                // WebSocket handles foreground while CapacitorHttp handles the
                // background.
                //
                // The background watcher is started fire-and-forget so a slow or
                // stalled addWatcher (e.g. while resolving "Always" permission)
                // can never block foreground location acquisition. Starting it
                // also surfaces iOS's "Always Allow" upgrade prompt while the app
                // is in the foreground.
                await this.startForegroundWatch(locationHandler);
                void this.startBackgroundWatch(locationHandler).catch((err: unknown) => {
                    console.warn('Failed to start background location watch', err);
                });
            } else {
                // On web, use standard geolocation only
                await this.startForegroundWatch(locationHandler);
            }
        } catch (err) {
            console.error('Failed to start location watch', err);
        }
    }

    private async startForegroundWatch(locationHandler: (position: Position | null, err?: unknown) => void): Promise<void> {
        this.watchId = await GeolocationPermission.watchLocation({
            maximumAge: 0,
            timeout: 10000,
            enableHighAccuracy: true
        }, locationHandler);
    }

    private async startBackgroundWatch(locationHandler: (position: Position | null, err?: unknown) => void): Promise<void> {
        await GeolocationPermission.startBackgroundLocation(locationHandler);
        this.backgroundWatchActive = true;
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
