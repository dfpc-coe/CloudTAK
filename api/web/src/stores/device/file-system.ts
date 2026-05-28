import type { DevicePermissionContext, WindowWithFilePicker } from './types.ts';

export class FileSystemPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        const pickerWindow = window as WindowWithFilePicker;

        if (!pickerWindow.showOpenFilePicker) {
            this.context.setPermissionStatus('fileSystem', 'unsupported');
            return;
        }

        const fileSystemHandle = this.context.getFileSystemHandle();
        if (fileSystemHandle?.queryPermission) {
            try {
                const status = await fileSystemHandle.queryPermission({ mode: 'read' });
                this.context.setPermissionStatus('fileSystem', status);
                return;
            } catch (err) {
                console.warn('Failed to query file system access status', err);
            }
        }

        this.context.setPermissionStatus('fileSystem', 'prompt');
    }

    async request(): Promise<void> {
        const pickerWindow = window as WindowWithFilePicker;

        if (!pickerWindow.showOpenFilePicker) {
            this.context.setPermissionStatus('fileSystem', 'unsupported');
            return;
        }

        try {
            const handles = await pickerWindow.showOpenFilePicker({ multiple: false });
            const handle = handles[0];

            if (!handle) {
                this.context.setPermissionStatus('fileSystem', 'unknown');
                return;
            }

            this.context.setFileSystemHandle(handle);

            if (handle.requestPermission) {
                const status = await handle.requestPermission({ mode: 'read' });
                this.context.setPermissionStatus('fileSystem', status);
            } else {
                this.context.setPermissionStatus('fileSystem', 'granted');
            }
        } finally {
            await this.refreshStatus();
        }
    }
}