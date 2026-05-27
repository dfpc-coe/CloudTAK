import { defineStore } from 'pinia';
import {
    checkNativeLocationPermission,
    getCurrentLocation,
    isNativePlatform,
    requestNativeLocationPermission,
    supportsLocationRequests
} from '../../base/capacitor.ts';

export type BrowserPermissionState = PermissionState | 'unsupported' | 'unknown';
export type BrowserPermissionType = 'location' | 'notification' | 'orientation' | 'storage' | 'camera' | 'wakeLock' | 'fileSystem';

type FileSystemAccessHandle = FileSystemHandle & {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type WindowWithFilePicker = Window & {
    showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<FileSystemAccessHandle[]>;
};

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
};

type DeviceOrientationEventWithCompass = DeviceOrientationEvent & {
    webkitCompassHeading?: number;
};

type DeviceOrientationEventName = 'deviceorientationabsolute' | 'deviceorientation';

function hasPermissionQuery(): boolean {
    return 'permissions' in navigator && typeof navigator.permissions?.query === 'function';
}

async function queryPermissionStatus(name: string, warning: string): Promise<PermissionStatus | null> {
    if (!hasPermissionQuery()) return null;

    try {
        return await navigator.permissions.query({ name } as PermissionDescriptor);
    } catch (err) {
        console.warn(warning, err);
        return null;
    }
}

function normalizeNotificationPermission(permission: NotificationPermission): BrowserPermissionState {
    return permission === 'default' ? 'prompt' : permission;
}

function supportsNotifications(): boolean {
    return 'Notification' in window;
}

export const usePermissionStore = defineStore('permissions', {
    state: (): {
        permissions: Record<BrowserPermissionType, BrowserPermissionState>;
        _wakeLockSentinel?: WakeLockSentinel | null;
        _fileSystemHandle?: FileSystemAccessHandle | null;
    } => {
        return {
            permissions: {
                location: 'unknown',
                notification: 'unknown',
                orientation: 'unknown',
                storage: 'unknown',
                camera: 'unknown',
                wakeLock: 'unknown',
                fileSystem: 'unknown'
            },
            _wakeLockSentinel: null,
            _fileSystemHandle: null
        };
    },
    actions: {
        hasOrientationSupport: function(): boolean {
            return 'DeviceOrientationEvent' in window && (
                'ondeviceorientation' in window
                || 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
            );
        },
        hasOrientationPermissionRequest: function(): boolean {
            if (!('DeviceOrientationEvent' in window)) return false;

            const orientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
            return typeof orientationEvent.requestPermission === 'function';
        },
        getOrientationEventName: function(): DeviceOrientationEventName {
            return 'ondeviceorientationabsolute' in (window as unknown as Record<string, unknown>)
                ? 'deviceorientationabsolute'
                : 'deviceorientation';
        },
        getOrientationHeading: function(event: DeviceOrientationEvent): number | null {
            const compassEvent = event as DeviceOrientationEventWithCompass;

            if (compassEvent.webkitCompassHeading !== undefined) {
                return compassEvent.webkitCompassHeading;
            }

            return event.alpha === null ? null : 360 - event.alpha;
        },
        addOrientationListener: function(listener: (event: DeviceOrientationEvent) => void): void {
            window.addEventListener(this.getOrientationEventName(), listener as EventListener);
        },
        removeOrientationListener: function(listener: (event: DeviceOrientationEvent) => void): void {
            window.removeEventListener(this.getOrientationEventName(), listener as EventListener);
        },
        setPermissionStatus: function(type: BrowserPermissionType, state: BrowserPermissionState): void {
            this.permissions[type] = state;
        },
        refreshLocationPermissionStatus: async function(): Promise<void> {
            if (isNativePlatform()) {
                this.setPermissionStatus('location', await checkNativeLocationPermission());
                return;
            }

            if (!supportsLocationRequests()) {
                this.setPermissionStatus('location', 'unsupported');
                return;
            }

            const status = await queryPermissionStatus('geolocation', 'Failed to query geolocation permission status');
            if (status) {
                this.setPermissionStatus('location', status.state);
                return;
            }

            this.setPermissionStatus('location', 'unknown');
        },
        refreshNotificationPermissionStatus: async function(): Promise<void> {
            if (!supportsNotifications()) {
                this.setPermissionStatus('notification', 'unsupported');
                return;
            }

            const status = await queryPermissionStatus('notifications', 'Failed to query notification permission status');
            if (status) {
                this.setPermissionStatus('notification', status.state);
                return;
            }

            this.setPermissionStatus('notification', normalizeNotificationPermission(Notification.permission));
        },
        refreshOrientationPermissionStatus: async function(): Promise<void> {
            if (!this.hasOrientationSupport()) {
                this.setPermissionStatus('orientation', 'unsupported');
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
                        this.setPermissionStatus('orientation', 'denied');
                        return;
                    }

                    if (states.length === sensorPermissions.length && states.every((state) => state === 'granted')) {
                        this.setPermissionStatus('orientation', 'granted');
                        return;
                    }

                    if (states.includes('prompt')) {
                        this.setPermissionStatus('orientation', 'prompt');
                        return;
                    }
                } catch (err) {
                    console.warn('Failed to query orientation permission status', err);
                }
            }

            if (this.hasOrientationPermissionRequest()) {
                this.setPermissionStatus('orientation', 'prompt');
            } else {
                this.setPermissionStatus('orientation', 'granted');
            }
        },
        refreshStoragePermissionStatus: async function(): Promise<void> {
            if (!('storage' in navigator) || !navigator.storage?.persisted) {
                this.setPermissionStatus('storage', 'unsupported');
                return;
            }

            const status = await queryPermissionStatus('persistent-storage', 'Failed to query persistent storage permission status');
            if (status) {
                this.setPermissionStatus('storage', status.state);
                return;
            }

            try {
                const persisted = await navigator.storage.persisted();
                this.setPermissionStatus('storage', persisted ? 'granted' : 'prompt');
            } catch (err) {
                console.warn('Failed to check persistent storage status', err);
                this.setPermissionStatus('storage', 'unknown');
            }
        },
        refreshCameraPermissionStatus: async function(): Promise<void> {
            if (!navigator.mediaDevices?.getUserMedia) {
                this.setPermissionStatus('camera', 'unsupported');
                return;
            }

            const status = await queryPermissionStatus('camera', 'Failed to query camera permission status');
            if (status) {
                this.setPermissionStatus('camera', status.state);
                return;
            }

            this.setPermissionStatus('camera', 'unknown');
        },
        refreshWakeLockPermissionStatus: async function(): Promise<void> {
            if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) {
                this.setPermissionStatus('wakeLock', 'unsupported');
                return;
            }

            if (this._wakeLockSentinel && !this._wakeLockSentinel.released) {
                this.setPermissionStatus('wakeLock', 'granted');
                return;
            }

            const status = await queryPermissionStatus('screen-wake-lock', 'Failed to query wake lock permission status');
            if (status) {
                this.setPermissionStatus('wakeLock', status.state);
                return;
            }

            this.setPermissionStatus('wakeLock', 'prompt');
        },
        refreshFileSystemPermissionStatus: async function(): Promise<void> {
            const pickerWindow = window as WindowWithFilePicker;

            if (!pickerWindow.showOpenFilePicker) {
                this.setPermissionStatus('fileSystem', 'unsupported');
                return;
            }

            if (this._fileSystemHandle?.queryPermission) {
                try {
                    const status = await this._fileSystemHandle.queryPermission({ mode: 'read' });
                    this.setPermissionStatus('fileSystem', status);
                    return;
                } catch (err) {
                    console.warn('Failed to query file system access status', err);
                }
            }

            this.setPermissionStatus('fileSystem', 'prompt');
        },
        refreshPermissionStatuses: async function(): Promise<void> {
            await Promise.all([
                this.refreshLocationPermissionStatus(),
                this.refreshNotificationPermissionStatus(),
                this.refreshOrientationPermissionStatus(),
                this.refreshStoragePermissionStatus(),
                this.refreshCameraPermissionStatus(),
                this.refreshWakeLockPermissionStatus(),
                this.refreshFileSystemPermissionStatus()
            ]);
        },
        requestLocationPermission: async function(onGranted?: () => void): Promise<void> {
            if (isNativePlatform()) {
                try {
                    const status = await requestNativeLocationPermission();
                    this.setPermissionStatus('location', status);

                    if (status === 'granted') {
                        onGranted?.();
                    }
                } finally {
                    await this.refreshLocationPermissionStatus();
                }

                return;
            }

            if (!supportsLocationRequests()) {
                this.setPermissionStatus('location', 'unsupported');
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
                await this.refreshLocationPermissionStatus();
            }
        },
        requestNotificationPermission: async function(): Promise<void> {
            if (!supportsNotifications()) {
                this.setPermissionStatus('notification', 'unsupported');
                return;
            }

            try {
                const status = await Notification.requestPermission();
                this.setPermissionStatus('notification', normalizeNotificationPermission(status));
            } finally {
                await this.refreshNotificationPermissionStatus();
            }
        },
        requestOrientationPermission: async function(): Promise<void> {
            if (!this.hasOrientationSupport()) {
                this.setPermissionStatus('orientation', 'unsupported');
                return;
            }

            try {
                if (this.hasOrientationPermissionRequest()) {
                    const orientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;

                    const status = await orientationEvent.requestPermission?.();
                    if (status) {
                        this.setPermissionStatus('orientation', status);
                    }
                } else {
                    this.setPermissionStatus('orientation', 'granted');
                }
            } finally {
                await this.refreshOrientationPermissionStatus();
            }
        },
        requestStoragePermission: async function(): Promise<void> {
            if (!('storage' in navigator) || !navigator.storage?.persist) {
                this.setPermissionStatus('storage', 'unsupported');
                return;
            }

            try {
                const persisted = await navigator.storage.persist();
                this.setPermissionStatus('storage', persisted ? 'granted' : 'denied');
            } finally {
                await this.refreshStoragePermissionStatus();
            }
        },
        requestCameraPermission: async function(): Promise<void> {
            if (!navigator.mediaDevices?.getUserMedia) {
                this.setPermissionStatus('camera', 'unsupported');
                return;
            }

            let stream: MediaStream | undefined;

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                this.setPermissionStatus('camera', 'granted');
            } finally {
                if (stream) {
                    for (const track of stream.getTracks()) {
                        track.stop();
                    }
                }

                await this.refreshCameraPermissionStatus();
            }
        },
        requestWakeLockPermission: async function(): Promise<void> {
            if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) {
                this.setPermissionStatus('wakeLock', 'unsupported');
                return;
            }

            try {
                const sentinel = await navigator.wakeLock.request('screen');
                this._wakeLockSentinel = sentinel;
                this.setPermissionStatus('wakeLock', 'granted');

                try {
                    await sentinel.release();
                } catch {
                    // Ignore release errors; permission status has already been updated.
                }
            } finally {
                await this.refreshWakeLockPermissionStatus();
            }
        },
        requestFileSystemPermission: async function(): Promise<void> {
            const pickerWindow = window as WindowWithFilePicker;

            if (!pickerWindow.showOpenFilePicker) {
                this.setPermissionStatus('fileSystem', 'unsupported');
                return;
            }

            try {
                const handles = await pickerWindow.showOpenFilePicker({ multiple: false });
                const handle = handles[0];

                if (!handle) {
                    this.setPermissionStatus('fileSystem', 'unknown');
                    return;
                }

                this._fileSystemHandle = handle;

                if (handle.requestPermission) {
                    const status = await handle.requestPermission({ mode: 'read' });
                    this.setPermissionStatus('fileSystem', status);
                } else {
                    this.setPermissionStatus('fileSystem', 'granted');
                }
            } finally {
                await this.refreshFileSystemPermissionStatus();
            }
        },
        initializePermissionSubscriptions: async function(onLocationGranted?: () => void): Promise<void> {
            await this.refreshPermissionStatuses();

            if (isNativePlatform()) {
                const status = await checkNativeLocationPermission();
                this.setPermissionStatus('location', status);

                if (status === 'granted') {
                    onLocationGranted?.();
                }
            } else if ('geolocation' in navigator) {
                const status = await queryPermissionStatus('geolocation', 'Failed to subscribe to geolocation permission changes');
                if (status) {
                    this.setPermissionStatus('location', status.state);
                    status.onchange = () => {
                        this.setPermissionStatus('location', status.state);

                        if (status.state === 'granted') {
                            onLocationGranted?.();
                        }
                    };
                }
            } else {
                console.error('Browser does not appear to support Geolocation');
                this.setPermissionStatus('location', 'unsupported');
            }

            if (supportsNotifications()) {
                const status = await queryPermissionStatus('notifications', 'Failed to subscribe to notification permission changes');
                if (status) {
                    this.setPermissionStatus('notification', status.state);
                    status.onchange = () => {
                        this.setPermissionStatus('notification', status.state);
                    };
                } else {
                    await this.refreshNotificationPermissionStatus();
                }
            } else {
                console.error('Browser does not appear to support Notifications');
                this.setPermissionStatus('notification', 'unsupported');
            }
        },
        releaseWakeLockSentinel: async function(): Promise<void> {
            const currentWakeLock = this._wakeLockSentinel;

            if (currentWakeLock && !currentWakeLock.released) {
                try {
                    await currentWakeLock.release();
                } catch (err) {
                    console.warn('Failed to release wake lock sentinel', err);
                }
            }

            this._wakeLockSentinel = null;
        }
    }
});
