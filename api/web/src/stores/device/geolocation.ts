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

    private watchId: CallbackID | null = null;
    private backgroundWatchId: CallbackID | null = null;
    private locationCallback: ((position: Position) => void) | null = null;
    private visibilityHandler: (() => void) | null = null;
    private isInBackground: boolean = false;

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

    static async watchBackgroundLocation(
        callback: (position: Position | null, err?: unknown) => void
    ): Promise<CallbackID> {
        // Use background-geolocation only when app is backgrounded
        return BackgroundGeolocation.addWatcher({
            backgroundTitle: 'CloudTAK GPS active',
            backgroundMessage: 'CloudTAK is sharing your location.',
            requestPermissions: true,
            stale: false,
            distanceFilter: 10
        }, (location?: BackgroundLocation, err?: BackgroundGeolocationError) => {
            callback(location ? GeolocationPermission.backgroundLocationToPosition(location) : null, err);
        });
    }

    static async clearLocationWatch(id: CallbackID): Promise<void> {
        await Geolocation.clearWatch({ id });
    }

    static async clearBackgroundLocationWatch(id: CallbackID): Promise<void> {
        await BackgroundGeolocation.removeWatcher({ id });
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
        if (this.backgroundWatchId !== null) {
            const id = this.backgroundWatchId;
            this.backgroundWatchId = null;
            try {
                await GeolocationPermission.clearBackgroundLocationWatch(id);
            } catch (err) {
                console.warn('Failed to clear background location watch', err);
            }
        }

        // Remove visibility listener
        if (this.visibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
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
            // Check initial visibility state
            this.isInBackground = typeof document !== 'undefined' && document.hidden;

            if (isNativePlatform()) {
                // On native platforms, switch between foreground and background watchers
                if (this.isInBackground) {
                    await this.startBackgroundWatch(locationHandler);
                } else {
                    await this.startForegroundWatch(locationHandler);
                    // Proactively request "Always" location permission while in the foreground.
                    // iOS will only show the upgrade dialog when the app is visible; calling
                    // addWatcher inside visibilitychange (background transition) is too late.
                    void this.requestBackgroundPermission();
                }
                this.setupVisibilityListener(locationHandler);
            } else {
                // On web, use standard geolocation only
                await this.startForegroundWatch(locationHandler);
            }
        } catch (err) {
            console.error('Failed to start location watch', err);
        }
    }

    /**
     * Briefly starts and removes a background watcher solely to trigger
     * iOS's "Always Allow" location permission upgrade dialog in the foreground.
     */
    private async requestBackgroundPermission(): Promise<void> {
        let id: CallbackID | undefined;
        try {
            id = await GeolocationPermission.watchBackgroundLocation(() => { /* permission probe only */ });
        } catch (err) {
            console.warn('Background location permission request failed', err);
            return;
        } finally {
            if (id !== undefined) {
                try {
                    await GeolocationPermission.clearBackgroundLocationWatch(id);
                } catch (cleanupErr) {
                    console.warn('Failed to clear background location permission probe watcher', cleanupErr);
                }
            }
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
        this.backgroundWatchId = await GeolocationPermission.watchBackgroundLocation(locationHandler);
    }

    private setupVisibilityListener(locationHandler: (position: Position | null, err?: unknown) => void): void {
        if (typeof document === 'undefined') return;

        this.visibilityHandler = async () => {
            const wasInBackground = this.isInBackground;
            this.isInBackground = document.hidden;

            // Only switch if state actually changed
            if (wasInBackground === this.isInBackground) return;

            try {
                if (this.isInBackground) {
                    // Switch to background watcher
                    if (this.watchId !== null) {
                        await GeolocationPermission.clearLocationWatch(this.watchId);
                        this.watchId = null;
                    }
                    if (this.backgroundWatchId === null) {
                        await this.startBackgroundWatch(locationHandler);
                    }
                } else {
                    // Switch to foreground watcher
                    if (this.backgroundWatchId !== null) {
                        await GeolocationPermission.clearBackgroundLocationWatch(this.backgroundWatchId);
                        this.backgroundWatchId = null;
                    }
                    if (this.watchId === null) {
                        await this.startForegroundWatch(locationHandler);
                    }
                }
            } catch (err) {
                console.error('Failed to switch location watcher', err);
            }
        };

        document.addEventListener('visibilitychange', this.visibilityHandler);
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
