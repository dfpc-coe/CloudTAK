import { Camera } from '@capacitor/camera';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class CameraPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    private static normalizeNativeCameraPermission(state: string | null | undefined): PermissionState | 'prompt' | 'unknown' {
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

    static async checkNativeCameraPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
        try {
            const status = await Camera.checkPermissions();
            return CameraPermission.normalizeNativeCameraPermission(status.camera);
        } catch (err) {
            console.warn('Failed to query native camera permission status', err);
            return 'unknown';
        }
    }

    static async requestNativeCameraPermission(): Promise<PermissionState | 'prompt' | 'unknown'> {
        try {
            const status = await Camera.requestPermissions({ permissions: ['camera'] });
            return CameraPermission.normalizeNativeCameraPermission(status.camera);
        } catch (err) {
            console.warn('Failed to request native camera permission', err);
            return 'unknown';
        }
    }

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            this.context.setPermissionStatus('camera', await CameraPermission.checkNativeCameraPermission());
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            this.context.setPermissionStatus('camera', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('camera', 'Failed to query camera permission status');
        if (status) {
            this.context.setPermissionStatus('camera', status.state);
            return;
        }

        this.context.setPermissionStatus('camera', 'unknown');
    }

    async request(): Promise<void> {
        if (isNativePlatform()) {
            try {
                this.context.setPermissionStatus('camera', await CameraPermission.requestNativeCameraPermission());
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
