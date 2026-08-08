import { ConnectionType, Network } from '@capawesome/capacitor-network';
import type { PluginListenerHandle } from '@capacitor/core';
import type { GetStatusResult } from '@capawesome/capacitor-network';

/**
 * Network status exposed by `@capawesome/capacitor-network` 0.1.2.
 *
 * A connection, including validated public internet access, does not guarantee
 * that the configured TAK server is reachable.
 */
export class NetworkStatus {
    private online: boolean = navigator.onLine;
    private connectionType: ConnectionType = ConnectionType.Unknown;
    private constrained: boolean | null = null;
    private expensive: boolean | null = null;
    private ultraConstrained: boolean | null = null;
    private reachable: boolean | null = null;
    private listener: PluginListenerHandle | null = null;

    // General connection state

    get isOnline(): boolean {
        return this.online;
    }

    get type(): ConnectionType {
        return this.connectionType;
    }

    // Android and iOS connection conditions, with Web fallbacks

    /**
     * Android: metered network with background data restricted by Data Saver.
     * iOS: Low Data Mode. Web: `navigator.connection.saveData`, if available.
     */
    get isConstrained(): boolean | null {
        return this.constrained;
    }

    /**
     * Android: metered network. iOS: `NWPath.isExpensive`. Unsupported on Web.
     */
    get isExpensive(): boolean | null {
        return this.expensive;
    }

    /**
     * Conservative minimize-data signal, not proof of a satellite connection.
     * Android: satellite on 15+, or bandwidth-constrained on 16+.
     * iOS: `NWPath.isUltraConstrained` on 26+. Unsupported on Web.
     * Android 14/15 SDK Extensions support is tracked in
     * capawesome-team/capacitor-plugins#964.
     */
    get isUltraConstrained(): boolean | null {
        return this.ultraConstrained;
    }

    // Android-only connection conditions

    /**
     * Android-validated public internet access. Unsupported on iOS and Web.
     * This does not indicate whether the configured TAK server is reachable.
     */
    get isInternetReachable(): boolean | null {
        return this.reachable;
    }

    async init(): Promise<void> {
        const status = await Network.getStatus();
        this.update(status);

        this.listener = await Network.addListener('networkStatusChange', (status) => {
            this.update(status);
        });
    }

    async destroy(): Promise<void> {
        if (this.listener) {
            await this.listener.remove();
            this.listener = null;
        }
    }

    private update(status: GetStatusResult): void {
        this.online = status.connected;
        this.connectionType = status.connectionType;
        this.constrained = status.constrained;
        this.expensive = status.expensive;
        this.ultraConstrained = status.ultraConstrained;
        this.reachable = status.internetReachable;
    }
}
