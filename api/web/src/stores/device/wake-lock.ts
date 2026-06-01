import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNativePlatform } from '../../base/capacitor.ts';
import { PermissionQuery } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class WakeLockPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (!await this.isSupported()) {
            this.context.setPermissionStatus('wakeLock', 'unsupported');
            return;
        }

        if (isNativePlatform()) {
            this.context.setPermissionStatus('wakeLock', 'granted');
            return;
        }

        if (await this.isKeptAwake()) {
            this.context.setPermissionStatus('wakeLock', 'granted');
            return;
        }

        const status = await PermissionQuery.queryPermissionStatus('screen-wake-lock', 'Failed to query wake lock permission status');
        if (status) {
            this.context.setPermissionStatus('wakeLock', status.state);
            return;
        }

        this.context.setPermissionStatus('wakeLock', 'prompt');
    }

    async request(): Promise<void> {
        if (!await this.isSupported()) {
            this.context.setPermissionStatus('wakeLock', 'unsupported');
            return;
        }

        try {
            await KeepAwake.keepAwake();
            this.context.setWakeLockSentinel(null);
            this.context.setPermissionStatus('wakeLock', 'granted');
        } finally {
            await this.refreshStatus();
        }
    }

    async releaseSentinel(): Promise<void> {
        const currentWakeLock = this.context.getWakeLockSentinel();

        if (await this.isSupported()) {
            try {
                await KeepAwake.allowSleep();
            } catch (err) {
                console.warn('Failed to release wake lock', err);
            }
        }

        if (currentWakeLock && !currentWakeLock.released) {
            try {
                await currentWakeLock.release();
            } catch (err) {
                console.warn('Failed to release wake lock sentinel', err);
            }
        }

        this.context.setWakeLockSentinel(null);
    }

    private async isSupported(): Promise<boolean> {
        try {
            const status = await KeepAwake.isSupported();
            return status.isSupported;
        } catch (err) {
            console.warn('Failed to query wake lock support', err);
            return false;
        }
    }

    private async isKeptAwake(): Promise<boolean> {
        try {
            const status = await KeepAwake.isKeptAwake();
            return status.isKeptAwake;
        } catch (err) {
            console.warn('Failed to query wake lock state', err);
            return false;
        }
    }
}
