import {
    checkNativeLocationPermission,
    getCurrentLocation,
    isNativePlatform,
    requestNativeLocationPermission,
    supportsLocationRequests
} from '../../base/capacitor.ts';
import { queryPermissionStatus } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class GeolocationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            this.context.setPermissionStatus('location', await checkNativeLocationPermission());
            return;
        }

        if (!supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
            return;
        }

        const status = await queryPermissionStatus('geolocation', 'Failed to query geolocation permission status');
        if (status) {
            this.context.setPermissionStatus('location', status.state);
            return;
        }

        this.context.setPermissionStatus('location', 'unknown');
    }

    async request(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await requestNativeLocationPermission();
                this.context.setPermissionStatus('location', status);

                if (status === 'granted') {
                    onGranted?.();
                }
            } finally {
                await this.refreshStatus();
            }

            return;
        }

        if (!supportsLocationRequests()) {
            this.context.setPermissionStatus('location', 'unsupported');
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
            await this.refreshStatus();
        }
    }

    async initializeSubscription(onGranted?: () => void): Promise<void> {
        if (isNativePlatform()) {
            const status = await checkNativeLocationPermission();
            this.context.setPermissionStatus('location', status);

            if (status === 'granted') {
                onGranted?.();
            }

            return;
        }

        if ('geolocation' in navigator) {
            const status = await queryPermissionStatus('geolocation', 'Failed to subscribe to geolocation permission changes');
            if (status) {
                this.context.setPermissionStatus('location', status.state);
                status.onchange = () => {
                    this.context.setPermissionStatus('location', status.state);

                    if (status.state === 'granted') {
                        onGranted?.();
                    }
                };
            }

            return;
        }

        console.error('Browser does not appear to support Geolocation');
        this.context.setPermissionStatus('location', 'unsupported');
    }
}