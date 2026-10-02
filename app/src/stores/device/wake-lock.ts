import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNativePlatform } from '../../utils/capacitor.ts';
import { PermissionQuery } from './shared.ts';
import { BatteryStatus } from './battery.ts';
import type { DevicePermissionContext } from './types.ts';

// Mirrors the Profile_Wake_Lock enum (api/common/enums.ts).
export type WakeLockMode = 'Default' | 'Charging' | 'Always On';

const WAKE_LOCK_DEFAULT: WakeLockMode = 'Default';
const WAKE_LOCK_CHARGING: WakeLockMode = 'Charging';
const WAKE_LOCK_ALWAYS: WakeLockMode = 'Always On';

const WAKE_LOCK_MODES: readonly WakeLockMode[] = [WAKE_LOCK_DEFAULT, WAKE_LOCK_CHARGING, WAKE_LOCK_ALWAYS];

/**
 * Coerce a stored preference (which may be a stale or corrupt value from an
 * older client) to a known mode. Falls back to "Charging" to match the
 * server-side profile default (api/stateless/lib/control/profile.ts).
 */
export function coerceWakeLockMode(value: unknown): WakeLockMode {
    return WAKE_LOCK_MODES.includes(value as WakeLockMode)
        ? value as WakeLockMode
        : WAKE_LOCK_CHARGING;
}

export class WakeLockPermission {
    private readonly battery = new BatteryStatus();
    private mode: WakeLockMode = WAKE_LOCK_DEFAULT;

    constructor(private readonly context: DevicePermissionContext) {}

    /**
     * Apply the user's wake lock display preference. "Always On" holds the
     * screen awake for the session, "Charging" only while the device is
     * charging, "Default" lets the OS sleep the screen normally.
     */
    async applyPreference(mode: unknown): Promise<void> {
        const resolved = coerceWakeLockMode(mode);
        this.mode = resolved;

        await this.battery.unwatch();

        if (!await this.isSupported()) {
            this.context.setPermissionStatus('wakeLock', 'unsupported');
            return;
        }

        if (resolved === WAKE_LOCK_ALWAYS) {
            await this.acquire();
        } else if (resolved === WAKE_LOCK_CHARGING) {
            await this.battery.watch((charging) => {
                void this.onChargingChange(charging);
            });
        } else {
            await this.releaseSentinel();
        }
    }

    async teardown(): Promise<void> {
        this.mode = WAKE_LOCK_DEFAULT;
        await this.battery.unwatch();
        await this.releaseSentinel();
    }

    private async onChargingChange(charging: boolean): Promise<void> {
        // A watch from a prior preference may still fire - ignore unless active
        if (this.mode !== WAKE_LOCK_CHARGING) return;

        if (charging) {
            await this.acquire();
        } else {
            await this.releaseSentinel();
        }
    }

    private async acquire(): Promise<void> {
        try {
            await KeepAwake.keepAwake();
            this.context.setWakeLockSentinel(null);
            this.context.setPermissionStatus('wakeLock', 'granted');
        } catch (err) {
            console.warn('Failed to acquire wake lock', err);
            await this.refreshStatus();
        }
    }

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
