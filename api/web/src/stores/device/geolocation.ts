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

export interface LocationWatchOptions {
    // Fixes are also POSTed directly from native code, independent of the WebView
    nativeDelivery?: {
        url: string;
        headers: Record<string, string>;
        minIntervalMs: number;
    };
}

const ALREADY_STARTED = 'ALREADY_STARTED';

function isAlreadyStarted(err: unknown): boolean {
    const e = err as { code?: string; message?: string } | undefined;
    return e?.code === ALREADY_STARTED || (typeof e?.message === 'string' && e.message.includes('already started'));
}

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    private watchActive = false;
    private watchGeneration = 0;
    private lastLocationTimestamp = 0;
    private lastFixReceivedAt = 0;
    private watchStartedAt = 0;
    private locationCallback: ((position: Position) => void) | null = null;
    private watchOptions: LocationWatchOptions = {};

    // No distance filter so a stationary device keeps producing background fixes
    private static readonly DISTANCE_FILTER_M = 0;
    private static readonly SEED_TIMEOUT_MS = 10000;
    private static readonly SEED_MAX_AGE_MS = 30000;
    private static readonly STALL_RESTART_MS = 120000;

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

    async startWatch(onLocation: (position: Position) => void, options: LocationWatchOptions = {}): Promise<void> {
        if (!GeolocationPermission.supportsLocationRequests()) return;
        await this.stopWatch();

        this.locationCallback = onLocation;
        this.watchOptions = options;
        this.lastLocationTimestamp = 0;
        this.lastFixReceivedAt = 0;
        this.watchStartedAt = Date.now();
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
            this.lastFixReceivedAt = Date.now();
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
            await this.startBackgroundWatch(handler);

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

    /**
     * Restart the watch if it has gone silent - iOS can end a location session
     * without any signal reaching JavaScript.
     */
    async ensureWatchHealthy(): Promise<void> {
        if (!this.locationCallback || !isNativePlatform()) return;

        const lastActivity = Math.max(this.lastFixReceivedAt, this.watchStartedAt);
        if (Date.now() - lastActivity < GeolocationPermission.STALL_RESTART_MS) return;

        console.warn(`No location fix in ${Math.round((Date.now() - lastActivity) / 1000)}s - restarting location watch`);
        await this.startWatch(this.locationCallback, this.watchOptions);
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

    private async startBackgroundWatch(handler: (position: Position | null, err?: unknown) => void): Promise<void> {
        // The native session outlives the WebView - after a page reload the
        // plugin still holds the previous session and rejects a new start
        if (isNativePlatform()) {
            await GeolocationPermission.stopNativeQuietly();
        }

        const delivery = this.watchOptions.nativeDelivery;

        const start = () => BackgroundGeolocation.start({
            backgroundTitle: 'CloudTAK GPS active',
            backgroundMessage: 'CloudTAK is sharing your location.',
            requestPermissions: true,
            // Reject fixes cached from before the watcher started - stale
            // positions are seeded explicitly by seedImmediateFix() instead,
            // which bounds their age.
            stale: false,
            distanceFilter: GeolocationPermission.DISTANCE_FILTER_M,
            ...(delivery ? {
                url: delivery.url,
                headers: delivery.headers,
                minIntervalMs: delivery.minIntervalMs
            } : {})
        }, (location?: BackgroundLocation, err?: BackgroundGeolocationError) => {
            handler(location ? GeolocationPermission.backgroundLocationToPosition(location) : null, err);
        });

        try {
            await start();
        } catch (err) {
            if (!isAlreadyStarted(err)) throw err;
            await GeolocationPermission.stopNativeQuietly();
            await start();
        }

        this.watchActive = true;
    }

    private static async stopNativeQuietly(): Promise<void> {
        try {
            await BackgroundGeolocation.stop();
        } catch (err) {
            console.warn('Failed to stop previous native location session', err);
        }
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
