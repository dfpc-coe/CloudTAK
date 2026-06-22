import { Network } from '@capacitor/network';
import type { PluginListenerHandle } from '@capacitor/core';
import type { ConnectionType } from '@capacitor/network';

export class NetworkStatus {
    private online: boolean = navigator.onLine;
    private connectionType: ConnectionType = 'unknown';
    private listener: PluginListenerHandle | null = null;

    get isOnline(): boolean {
        return this.online;
    }

    get type(): ConnectionType {
        return this.connectionType;
    }

    async init(): Promise<void> {
        const status = await Network.getStatus();
        this.online = status.connected;
        this.connectionType = status.connectionType;

        this.listener = await Network.addListener('networkStatusChange', (status) => {
            this.online = status.connected;
            this.connectionType = status.connectionType;
        });
    }

    async destroy(): Promise<void> {
        if (this.listener) {
            await this.listener.remove();
            this.listener = null;
        }
    }
}
