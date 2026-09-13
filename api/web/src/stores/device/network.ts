import { ConnectionType, Network } from '@capawesome/capacitor-network';
import type { PluginListenerHandle } from '@capacitor/core';
import type { GetStatusResult } from '@capawesome/capacitor-network';
import { WorkerMessageType } from '../../utils/events.ts';
import type { WorkerMessage, NetworkChangeBody } from '../../utils/events.ts';

/**
 * Network status exposed by `@capawesome/capacitor-network` 0.1.3.
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
    private channel: BroadcastChannel | null = null;

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
     * Android: satellite on 15+, or bandwidth-constrained when API 36 or
     * U Extensions 16 is available.
     * iOS: `NWPath.isUltraConstrained` on 26+. Unsupported on Web.
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
        if (!this.channel && typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel('cloudtak');
        }

        const status = await Network.getStatus();
        this.update(status);
        this.broadcast();

        this.listener = await Network.addListener('networkStatusChange', (status) => {
            this.update(status);
        });
    }

    async destroy(): Promise<void> {
        if (this.listener) {
            await this.listener.remove();
            this.listener = null;
        }

        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
    }

    private broadcast(): void {
        if (!this.channel) return;

        this.channel.postMessage({
            type: WorkerMessageType.Network_Change,
            body: { online: this.online } satisfies NetworkChangeBody
        } satisfies WorkerMessage);
    }

    private update(status: GetStatusResult): void {
        const wasOnline = this.online;

        this.online = status.connected;
        this.connectionType = status.connectionType;
        this.constrained = status.constrained;
        this.expensive = status.expensive;
        this.ultraConstrained = status.ultraConstrained;
        this.reachable = status.internetReachable;

        if (this.online !== wasOnline) this.broadcast();
    }
}
