export type BrowserPermissionState = PermissionState | 'unsupported' | 'unknown';
export type BrowserPermissionType = 'location' | 'notification' | 'orientation' | 'storage' | 'camera' | 'wakeLock' | 'fileSystem';

export type FileSystemAccessHandle = FileSystemHandle & {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export type WindowWithFilePicker = Window & {
    showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<FileSystemAccessHandle[]>;
};

export interface DevicePermissionContext {
    permissions: Record<BrowserPermissionType, BrowserPermissionState>;
    setPermissionStatus: (type: BrowserPermissionType, state: BrowserPermissionState) => void;
    getWakeLockSentinel: () => WakeLockSentinel | null;
    setWakeLockSentinel: (sentinel: WakeLockSentinel | null) => void;
    getFileSystemHandle: () => FileSystemAccessHandle | null;
    setFileSystemHandle: (handle: FileSystemAccessHandle | null) => void;
}