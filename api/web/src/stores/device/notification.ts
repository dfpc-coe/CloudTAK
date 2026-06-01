import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import type { PermissionStatus as FirebaseMessagingPermissionStatus } from '@capacitor-firebase/messaging';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery } from './shared.ts';
import type { BrowserPermissionState, DevicePermissionContext } from './types.ts';

export class BrowserNotificationPermission {
    private static normalizeNotificationPermission(permission: NotificationPermission): BrowserPermissionState {
        return permission === 'default' ? 'prompt' : permission;
    }

    private static normalizeNativeNotificationPermission(permission: FirebaseMessagingPermissionStatus['receive']): BrowserPermissionState {
        return permission === 'prompt-with-rationale' ? 'prompt' : permission;
    }

    private static supportsNotifications(): boolean {
        return 'Notification' in window;
    }

    private messagingToken: string | null = null;
    private tokenListener: PluginListenerHandle | null = null;

    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (isNativePlatform()) {
            await this.refreshNativeStatus();
            return;
        }

        if (!BrowserNotificationPermission.supportsNotifications()) {
            this.context.setPermissionStatus('notification', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('notifications', 'Failed to query notification permission status');
        if (status) {
            this.context.setPermissionStatus('notification', status.state);
            return;
        }

        this.context.setPermissionStatus('notification', BrowserNotificationPermission.normalizeNotificationPermission(Notification.permission));
    }

    async request(): Promise<void> {
        if (isNativePlatform()) {
            try {
                const status = await FirebaseMessaging.requestPermissions();
                this.context.setPermissionStatus('notification', BrowserNotificationPermission.normalizeNativeNotificationPermission(status.receive));

                if (status.receive === 'granted') {
                    await this.refreshMessagingToken();
                }
            } finally {
                await this.refreshStatus();
            }

            return;
        }

        if (!BrowserNotificationPermission.supportsNotifications()) {
            this.context.setPermissionStatus('notification', 'unsupported');
            return;
        }

        try {
            const status = await Notification.requestPermission();
            this.context.setPermissionStatus('notification', BrowserNotificationPermission.normalizeNotificationPermission(status));
        } finally {
            await this.refreshStatus();
        }
    }

    async initializeSubscription(): Promise<void> {
        if (isNativePlatform()) {
            await this.refreshStatus();
            await this.initializeNativeMessaging();
            return;
        }

        if (!BrowserNotificationPermission.supportsNotifications()) {
            console.error('Browser does not appear to support Notifications');
            this.context.setPermissionStatus('notification', 'unsupported');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('notifications', 'Failed to subscribe to notification permission changes');
        if (status) {
            this.context.setPermissionStatus('notification', status.state);
            status.onchange = () => {
                this.context.setPermissionStatus('notification', status.state);
            };
        } else {
            await this.refreshStatus();
        }
    }

    getMessagingToken(): string | null {
        return this.messagingToken;
    }

    async refreshMessagingToken(): Promise<string | null> {
        if (!isNativePlatform()) {
            this.messagingToken = null;
            return null;
        }

        try {
            const support = await FirebaseMessaging.isSupported();
            if (!support.isSupported) {
                this.messagingToken = null;
                return null;
            }

            const status = await FirebaseMessaging.checkPermissions();
            if (status.receive !== 'granted') {
                this.messagingToken = null;
                return null;
            }

            const result = await FirebaseMessaging.getToken();
            this.messagingToken = result.token || null;
            return this.messagingToken;
        } catch (err) {
            console.warn('Failed to refresh native notification token', err);
            this.messagingToken = null;
            return null;
        }
    }

    async deleteMessagingToken(): Promise<void> {
        if (!isNativePlatform()) return;

        try {
            await FirebaseMessaging.deleteToken();
        } catch (err) {
            console.warn('Failed to delete native notification token', err);
        } finally {
            this.messagingToken = null;
        }
    }

    private async refreshNativeStatus(): Promise<void> {
        try {
            const support = await FirebaseMessaging.isSupported();
            if (!support.isSupported) {
                this.context.setPermissionStatus('notification', 'unsupported');
                return;
            }

            const status = await FirebaseMessaging.checkPermissions();
            this.context.setPermissionStatus('notification', BrowserNotificationPermission.normalizeNativeNotificationPermission(status.receive));
        } catch (err) {
            console.warn('Failed to query native notification permission status', err);
            this.context.setPermissionStatus('notification', 'unknown');
        }
    }

    private async initializeNativeMessaging(): Promise<void> {
        try {
            if (!this.tokenListener) {
                this.tokenListener = await FirebaseMessaging.addListener('tokenReceived', (event) => {
                    this.messagingToken = event.token;
                });
            }

            if (this.context.permissions.notification === 'granted') {
                await this.refreshMessagingToken();
            }
        } catch (err) {
            console.warn('Failed to initialize native notification messaging', err);
        }
    }
}
