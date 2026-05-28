import { queryPermissionStatus } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class CameraPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (!navigator.mediaDevices?.getUserMedia) {
            this.context.setPermissionStatus('camera', 'unsupported');
            return;
        }

        const status = await queryPermissionStatus('camera', 'Failed to query camera permission status');
        if (status) {
            this.context.setPermissionStatus('camera', status.state);
            return;
        }

        this.context.setPermissionStatus('camera', 'unknown');
    }

    async request(): Promise<void> {
        if (!navigator.mediaDevices?.getUserMedia) {
            this.context.setPermissionStatus('camera', 'unsupported');
            return;
        }

        let stream: MediaStream | undefined;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.context.setPermissionStatus('camera', 'granted');
        } finally {
            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }

            await this.refreshStatus();
        }
    }
}