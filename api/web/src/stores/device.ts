import { defineStore } from 'pinia';
import { markRaw, reactive, ref } from 'vue';
import { CameraPermission } from './camera.ts';
import { FileSystemPermission } from './file-system.ts';
import { GeolocationPermission } from './geolocation.ts';
import { BrowserNotificationPermission } from './notification.ts';
import { OrientationPermission } from './orientation.ts';
import { StoragePermission } from './storage.ts';
import { WakeLockPermission } from './wake-lock.ts';
import type { BrowserPermissionState, BrowserPermissionType, DevicePermissionContext, FileSystemAccessHandle } from './types.ts';

export type { BrowserPermissionState, BrowserPermissionType } from './types.ts';
export { CameraPermission } from './camera.ts';
export { FileSystemPermission } from './file-system.ts';
export { GeolocationPermission } from './geolocation.ts';
export { BrowserNotificationPermission } from './notification.ts';
export { OrientationPermission } from './orientation.ts';
export { StoragePermission } from './storage.ts';
export { WakeLockPermission } from './wake-lock.ts';

export const usePermissionStore = defineStore('permissions', () => {
    const permissions = reactive<Record<BrowserPermissionType, BrowserPermissionState>>({
        location: 'unknown',
        notification: 'unknown',
        orientation: 'unknown',
        storage: 'unknown',
        camera: 'unknown',
        wakeLock: 'unknown',
        fileSystem: 'unknown'
    });

    const wakeLockSentinel = ref<WakeLockSentinel | null>(null);
    const fileSystemHandle = ref<FileSystemAccessHandle | null>(null);

    function setPermissionStatus(type: BrowserPermissionType, state: BrowserPermissionState): void {
        permissions[type] = state;
    }

    const context: DevicePermissionContext = {
        permissions,
        setPermissionStatus,
        getWakeLockSentinel: () => wakeLockSentinel.value,
        setWakeLockSentinel: (sentinel) => {
            wakeLockSentinel.value = sentinel;
        },
        getFileSystemHandle: () => fileSystemHandle.value,
        setFileSystemHandle: (handle) => {
            fileSystemHandle.value = handle;
        }
    };

    const geolocation = markRaw(new GeolocationPermission(context));
    const notification = markRaw(new BrowserNotificationPermission(context));
    const orientation = markRaw(new OrientationPermission(context));
    const storage = markRaw(new StoragePermission(context));
    const camera = markRaw(new CameraPermission(context));
    const wakeLock = markRaw(new WakeLockPermission(context));
    const fileSystem = markRaw(new FileSystemPermission(context));

    async function refreshPermissionStatuses(): Promise<void> {
        await Promise.all([
            geolocation.refreshStatus(),
            notification.refreshStatus(),
            orientation.refreshStatus(),
            storage.refreshStatus(),
            camera.refreshStatus(),
            wakeLock.refreshStatus(),
            fileSystem.refreshStatus()
        ]);
    }

    async function initializePermissionSubscriptions(onLocationGranted?: () => void): Promise<void> {
        await refreshPermissionStatuses();
        await Promise.all([
            geolocation.initializeSubscription(onLocationGranted),
            notification.initializeSubscription()
        ]);
    }

    return {
        permissions,
        geolocation,
        notification,
        orientation,
        storage,
        camera,
        wakeLock,
        fileSystem,
        setPermissionStatus,
        refreshPermissionStatuses,
        initializePermissionSubscriptions,
        hasOrientationSupport: () => orientation.hasSupport(),
        hasOrientationPermissionRequest: () => orientation.hasPermissionRequest(),
        getOrientationEventName: () => orientation.getEventName(),
        getOrientationHeading: (event: DeviceOrientationEvent) => orientation.getHeading(event),
        addOrientationListener: (listener: (event: DeviceOrientationEvent) => void) => orientation.addListener(listener),
        removeOrientationListener: (listener: (event: DeviceOrientationEvent) => void) => orientation.removeListener(listener),
        refreshLocationPermissionStatus: () => geolocation.refreshStatus(),
        refreshNotificationPermissionStatus: () => notification.refreshStatus(),
        refreshOrientationPermissionStatus: () => orientation.refreshStatus(),
        refreshStoragePermissionStatus: () => storage.refreshStatus(),
        refreshCameraPermissionStatus: () => camera.refreshStatus(),
        refreshWakeLockPermissionStatus: () => wakeLock.refreshStatus(),
        refreshFileSystemPermissionStatus: () => fileSystem.refreshStatus(),
        requestLocationPermission: (onGranted?: () => void) => geolocation.request(onGranted),
        requestNotificationPermission: () => notification.request(),
        requestOrientationPermission: () => orientation.request(),
        requestStoragePermission: () => storage.request(),
        requestCameraPermission: () => camera.request(),
        requestWakeLockPermission: () => wakeLock.request(),
        requestFileSystemPermission: () => fileSystem.request(),
        releaseWakeLockSentinel: () => wakeLock.releaseSentinel()
    };
});

export const useDeviceStore = usePermissionStore;