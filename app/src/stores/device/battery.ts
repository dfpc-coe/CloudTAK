import { isNativePlatform } from '../../utils/capacitor.ts';

// The web Battery Status API is not in the standard DOM typings and is absent
// in iOS WebKit - model just the bits we consume.
interface WebBatteryManager extends EventTarget {
    charging: boolean;
    level: number;
}

export interface BatteryInfo {
    /** Battery level as a percentage (0-100), or null when unknown. */
    level: number | null;
    /** Whether the device is charging, or null when unknown. */
    charging: boolean | null;
}

type WebNavigator = Navigator & {
    getBattery?: () => Promise<WebBatteryManager>;
};

// Native exposes no charge-change event, so we poll on this cadence.
const NATIVE_POLL_MS = 30000;

/**
 * Cross-platform charging-state source for the "Charging" wake lock mode.
 * Native uses `@capacitor/device` (imported lazily, polled); web uses the
 * `navigator.getBattery()` Battery Status API where available.
 */
export class BatteryStatus {
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private webBattery: WebBatteryManager | null = null;
    private webListener: (() => void) | null = null;
    private webManagerPromise: Promise<WebBatteryManager | null> | null = null;

    async isCharging(): Promise<boolean> {
        return (await this.info()).charging ?? false;
    }

    async info(): Promise<BatteryInfo> {
        if (isNativePlatform()) {
            try {
                const { Device } = await import('@capacitor/device');
                const info = await Device.getBatteryInfo();

                // Native reports level as a 0-1 fraction; negative values
                // (e.g. iOS simulator) mean the level is unknown.
                const level = typeof info.batteryLevel === 'number' && info.batteryLevel >= 0
                    ? Math.round(info.batteryLevel * 100)
                    : null;

                return { level, charging: info.isCharging ?? null };
            } catch (err) {
                console.warn('Failed to read native battery info', err);
                return { level: null, charging: null };
            }
        }

        const battery = await this.webBatteryManager();
        if (!battery) return { level: null, charging: null };

        return {
            level: typeof battery.level === 'number' ? Math.round(battery.level * 100) : null,
            charging: battery.charging
        };
    }

    async watch(onChange: (charging: boolean) => void): Promise<void> {
        await this.unwatch();

        const emit = async (): Promise<void> => {
            onChange(await this.isCharging());
        };

        if (!isNativePlatform()) {
            const battery = await this.webBatteryManager();
            if (battery) {
                const handler = (): void => { void emit(); };
                battery.addEventListener('chargingchange', handler);
                this.webBattery = battery;
                this.webListener = (): void => battery.removeEventListener('chargingchange', handler);
            }

            // Without the Battery Status API (iOS WebKit) charging state is
            // unknowable and isCharging() always reports false - polling would
            // be a permanent no-op, so just emit the one known state
            await emit();
            return;
        }

        this.pollTimer = setInterval(() => { void emit(); }, NATIVE_POLL_MS);
        await emit();
    }

    async unwatch(): Promise<void> {
        if (this.webListener) {
            this.webListener();
            this.webListener = null;
        }
        this.webBattery = null;

        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private async webBatteryManager(): Promise<WebBatteryManager | null> {
        if (typeof navigator === 'undefined') return null;

        const nav = navigator as WebNavigator;
        if (typeof nav.getBattery !== 'function') return null;

        // The BatteryManager instance is stable for the lifetime of the page
        // and info() is called on every location fix, so memoize the lookup.
        // A failed lookup resets the cache so the next call retries.
        if (!this.webManagerPromise) {
            this.webManagerPromise = nav.getBattery().catch((err): null => {
                console.warn('Failed to read web battery info', err);
                this.webManagerPromise = null;
                return null;
            });
        }

        return await this.webManagerPromise;
    }
}
