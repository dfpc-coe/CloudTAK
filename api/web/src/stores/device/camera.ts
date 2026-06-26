import { Camera } from '@capacitor/camera';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery, normalizePermissionState } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class CameraPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await Camera.checkPermissions();
                this.context.setPermissionStatus('camera', normalizePermissionState(status.camera));
            } catch (err) {
                console.warn('Failed to query native camera permission status', err);
                this.context.setPermissionStatus('camera', 'unknown');
            }
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            this.context.setPermissionStatus('camera', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('camera', 'Failed to query camera permission status');
        this.context.setPermissionStatus('camera', status ? status.state : 'unknown');
    }

    async request(): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await Camera.requestPermissions({ permissions: ['camera'] });
                this.context.setPermissionStatus('camera', normalizePermissionState(status.camera));
            } catch (err) {
                console.warn('Failed to request native camera permission', err);
                this.context.setPermissionStatus('camera', 'unknown');
            } finally {
                await this.refreshStatus();
            }
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            this.context.setPermissionStatus('camera', 'unsupported');
            return;
        }

        let stream: MediaStream | undefined;
        let granted = false;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            granted = true;
            this.context.setPermissionStatus('camera', 'granted');
        } finally {
            if (stream) {
                for (const track of stream.getTracks()) {
                    track.stop();
                }
            }

            const status = await PermissionQuery.queryPermissionStatus('camera', 'Failed to query camera permission status');
            if (status) {
                this.context.setPermissionStatus('camera', status.state);
            } else if (!granted) {
                this.context.setPermissionStatus('camera', 'unknown');
            }
        }
    }
}
