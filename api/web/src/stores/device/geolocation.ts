import { Geolocation } from '@capacitor/geolocation';
import type { Position } from '@capacitor/geolocation';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import type {
    CallbackError as BackgroundGeolocationError,
    Location as BackgroundLocation
} from '@capgo/background-geolocation';
import { isNativePlatform } from '../../utils/capacitor.ts';
import { PermissionQuery, normalizePermissionState } from './shared.ts';
import type { BrowserPermissionState, DevicePermissionContext } from './types.ts';

/**
 * When set, the native layer POSTs each fix to `url` directly, independent of
 * the WebView - iOS suspends the WebContent process in the background, so
 * bridge-delivered fixes stop flowing while native delivery keeps working.
 */
export type NativeDeliveryOptions = {
    url: string;
    headers?: Record<string, string>;
    /** Minimum ms between native POSTs (and the Android update interval). */
    minIntervalMs?: number;
};

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    private watchActive = false;
    private watchGeneration = 0;
    private lastLocationTimestamp = 0;
    private locationCallback: ((position: Position) => void) | null = null;

    // The background watcher only emits fixes newer than its own start time,
    // so the first position can take seconds to arrive. A one-shot fix seeds
    // the initial position instead.
    private static readonly SEED_TIMEOUT_MS = 10000;
    private static readonly SEED_MAX_AGE_MS = 30000;

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
            await this.refreshBackgroundStatus();
            return;
        }

        this.context.setPermissionStatus('backgroundLocation', 'unsupported');

        if (!GeolocationPermission.supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('geolocation', 'Failed to query geolocation permission status');
        this.context.setPermissionStatus('location', status ? status.state : 'unknown');
    }

    // Only the background plugin distinguishes iOS "Always" from
    // "While Using App" - @capacitor/geolocation reports both as granted.
    private async refreshBackgroundStatus(): Promise<void> {
        try {
            const status = await BackgroundGeolocation.checkPermissions();
            let state: BrowserPermissionState;
            if (status.backgroundLocation === 'when_in_use') {
                state = 'when_in_use';
            } else if (status.backgroundLocation === 'always') {
                state = 'granted';
            } else {
                state = normalizePermissionState(status.backgroundLocation);
            }
            this.context.setPermissionStatus('backgroundLocation', state);
        } catch (err) {
            console.warn('Failed to query background location permission status', err);
            this.context.setPermissionStatus('backgroundLocation', 'unknown');
        }
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

    async startWatch(onLocation: (position: Position) => void, native?: NativeDeliveryOptions): Promise<void> {
        if (!GeolocationPermission.supportsLocationRequests()) return;
        await this.stopWatch();

        this.locationCallback = onLocation;
        this.lastLocationTimestamp = 0;
        const generation = ++this.watchGeneration;

        const handler = (position: Position | null, err?: unknown) => {
            if (err) {
                console.error('Location Error', err);
                return;
            }
            if (!position || generation !== this.watchGeneration || !this.locationCallback) return;
            // The seeded fix can resolve after a watcher fix has landed
            if (position.timestamp < this.lastLocationTimestamp) return;
            this.lastLocationTimestamp = position.timestamp;
            this.locationCallback(position);
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
            await this.startBackgroundWatch(handler, native);

            void this.seedImmediateFix(handler, generation);
        } catch (err) {
            console.error('Failed to start location watch', err);
        }
    }

    // Started alongside the watcher, not awaited: the watcher must not wait on a
    // fix that can take seconds or never arrive.
    private async seedImmediateFix(
        handler: (position: Position | null, err?: unknown) => void,
        generation: number
    ): Promise<void> {
        if (['denied', 'unsupported'].includes(this.context.permissions.location)) return;

        try {
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: GeolocationPermission.SEED_TIMEOUT_MS,
                maximumAge: GeolocationPermission.SEED_MAX_AGE_MS
            });

            if (generation !== this.watchGeneration) return;
            handler(position);
        } catch (err) {
            console.warn('No immediate GPS fix available, waiting on location watch', err);
        }
    }

    async stopWatch(): Promise<void> {
        this.watchGeneration++;

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

    private async startBackgroundWatch(
        handler: (position: Position | null, err?: unknown) => void,
        native?: NativeDeliveryOptions
    ): Promise<void> {
        await BackgroundGeolocation.start({
            backgroundTitle: 'CloudTAK GPS active',
            backgroundMessage: 'CloudTAK is sharing your location.',
            requestPermissions: true,
            // Reject fixes cached from before the watcher started - stale
            // positions are seeded explicitly by seedImmediateFix() instead,
            // which bounds their age.
            stale: false,
            // A distance filter would suppress fixes while stationary, staling
            // the user out on the TAK server - rely on minIntervalMs for rate
            // limiting instead so parked devices still emit heartbeats.
            distanceFilter: 0,
            ...(native ? {
                url: native.url,
                headers: native.headers,
                minIntervalMs: native.minIntervalMs
            } : {})
        }, (location?: BackgroundLocation, err?: BackgroundGeolocationError) => {
            handler(location ? GeolocationPermission.backgroundLocationToPosition(location) : null, err);
        });
        this.watchActive = true;
    }

    /**
     * Point native POST delivery at a rotated auth token. Best-effort: the
     * watch restarts with fresh headers on the next app boot regardless.
     */
    static async updateNativeHeaders(headers: Record<string, string>): Promise<void> {
        if (!isNativePlatform()) return;
        try {
            await BackgroundGeolocation.updateHeaders({ headers });
        } catch (err) {
            console.warn('Failed to update native location delivery headers', err);
        }
    }

    async openNativeSettings(): Promise<void> {
        await BackgroundGeolocation.openSettings();
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
