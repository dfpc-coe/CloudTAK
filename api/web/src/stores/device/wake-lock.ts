import { queryPermissionStatus } from './shared.ts';
import type { DevicePermissionContext } from './types.ts';

export class WakeLockPermission {
    constructor(private readonly context: DevicePermissionContext) {}

    async refreshStatus(): Promise<void> {
        if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) {
            this.context.setPermissionStatus('wakeLock', 'unsupported');
            return;
        }

        const wakeLockSentinel = this.context.getWakeLockSentinel();
        if (wakeLockSentinel && !wakeLockSentinel.released) {
            this.context.setPermissionStatus('wakeLock', 'granted');
            return;
        }

        const status = await queryPermissionStatus('screen-wake-lock', 'Failed to query wake lock permission status');
        if (status) {
            this.context.setPermissionStatus('wakeLock', status.state);
            return;
        }

        this.context.setPermissionStatus('wakeLock', 'prompt');
    }

    async request(): Promise<void> {
        if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) {
            this.context.setPermissionStatus('wakeLock', 'unsupported');
            return;
        }

        try {
            const sentinel = await navigator.wakeLock.request('screen');
            this.context.setWakeLockSentinel(sentinel);
            this.context.setPermissionStatus('wakeLock', 'granted');

            try {
                await sentinel.release();
            } catch {
                // Ignore release errors; permission status has already been updated.
            }
        } finally {
            await this.refreshStatus();
        }
    }

    async releaseSentinel(): Promise<void> {
        const currentWakeLock = this.context.getWakeLockSentinel();

        if (currentWakeLock && !currentWakeLock.released) {
            try {
                await currentWakeLock.release();
            } catch (err) {
                console.warn('Failed to release wake lock sentinel', err);
            }
        }

        this.context.setWakeLockSentinel(null);
    }
}