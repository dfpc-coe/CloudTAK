import { queryPermissionStatus } from './shared.ts';
import type { BrowserPermissionState, DevicePermissionContext } from './types.ts';

function normalizeNotificationPermission(permission: NotificationPermission): BrowserPermissionState {
    return permission === 'default' ? 'prompt' : permission;
}

function supportsNotifications(): boolean {
    return 'Notification' in window;
}

export class BrowserNotificationPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (!supportsNotifications()) {
            this.context.setPermissionStatus('notification', 'unsupported');
            return;
        }

        const status = await queryPermissionStatus('notifications', 'Failed to query notification permission status');
        if (status) {
            this.context.setPermissionStatus('notification', status.state);
            return;
        }

        this.context.setPermissionStatus('notification', normalizeNotificationPermission(Notification.permission));
    }

    async request(): Promise<void> {
        if (!supportsNotifications()) {
            this.context.setPermissionStatus('notification', 'unsupported');
            return;
        }

        try {
            const status = await Notification.requestPermission();
            this.context.setPermissionStatus('notification', normalizeNotificationPermission(status));
        } finally {
            await this.refreshStatus();
        }
    }

    async initializeSubscription(): Promise<void> {
        if (!supportsNotifications()) {
            console.error('Browser does not appear to support Notifications');
            this.context.setPermissionStatus('notification', 'unsupported');
            return;
        }

        const status = await queryPermissionStatus('notifications', 'Failed to subscribe to notification permission changes');
        if (status) {
            this.context.setPermissionStatus('notification', status.state);
            status.onchange = () => {
                this.context.setPermissionStatus('notification', status.state);
            };
        } else {
            await this.refreshStatus();
        }
    }
}
