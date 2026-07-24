import { isNativePlatform } from '../../base/capacitor.ts';

// The web Battery Status API is not in the standard DOM typings and is absent
// in iOS WebKit - model just the bits we consume.
interface WebBatteryManager extends EventTarget {
    charging: boolean;
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

    async isCharging(): Promise<boolean> {
        if (isNativePlatform()) {
            try {
                const { Device } = await import('@capacitor/device');
                const info = await Device.getBatteryInfo();
                return info.isCharging ?? false;
            } catch (err) {
                console.warn('Failed to read native battery info', err);
                return false;
            }
        }

        const battery = await this.webBatteryManager();
        return battery ? battery.charging : false;
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
                await emit();
                return;
            }
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

        try {
            return await nav.getBattery();
        } catch (err) {
            console.warn('Failed to read web battery info', err);
            return null;
        }
    }
}
