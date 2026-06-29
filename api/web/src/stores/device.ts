import { defineStore } from 'pinia';
import { markRaw, reactive, ref } from 'vue';
import { CameraPermission } from './device/camera.ts';
import { FileSystemPermission } from './device/file-system.ts';
import { GeolocationPermission } from './device/geolocation.ts';
import { BrowserNotificationPermission } from './device/notification.ts';
import { OrientationPermission } from './device/orientation.ts';
import { StoragePermission } from './device/storage.ts';
import { WakeLockPermission } from './device/wake-lock.ts';
import { NetworkStatus } from './device/network.ts';
import type { BrowserPermissionState, BrowserPermissionType, DevicePermissionContext, FileSystemAccessHandle } from './device/types.ts';
export type { BrowserPermissionState, BrowserPermissionType } from './device/types.ts';
export { CameraPermission } from './device/camera.ts';
export { FileSystemPermission } from './device/file-system.ts';
export { GeolocationPermission } from './device/geolocation.ts';
export { BrowserNotificationPermission } from './device/notification.ts';
export { OrientationPermission } from './device/orientation.ts';
export { StoragePermission } from './device/storage.ts';
export { WakeLockPermission } from './device/wake-lock.ts';
export { NetworkStatus } from './device/network.ts';

export const useDeviceStore = defineStore('device', () => {
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
    const network = markRaw(new NetworkStatus());

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
            notification.initializeSubscription(),
            network.init()
        ]);
    }

    return {
        permissions,
        network,
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
        refreshLocationPermissionStatus: () => geolocation.refreshStatus(),
        refreshNotificationPermissionStatus: () => notification.refreshStatus(),
        getMessagingToken: () => notification.getMessagingToken(),
        refreshMessagingToken: () => notification.refreshMessagingToken(),
        onMessagingToken: (listener: (token: string | null) => void) => notification.onToken(listener),
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
