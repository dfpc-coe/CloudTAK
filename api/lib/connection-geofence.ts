import { Tile38, type Tile38Options } from '@iwpnd/tile38-ts';
import Config from './config.js';

type GeofenceSettings = {
    'geofence::enabled': boolean;
    'geofence::url': string;
    'geofence::password': string;
};

type GeofenceConnectionState = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closing';

export type GeofenceStatus = {
    state: GeofenceConnectionState;
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    url: string;
    reconnectAttempts: number;
    lastError?: string;
};

const DEFAULT_GEOFENCE_SETTINGS: GeofenceSettings = {
    'geofence::enabled': false,
    'geofence::url': '',
    'geofence::password': ''
};

function toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
}

function buildTile38Options(rawUrl: string, rawPassword: string): Tile38Options {
    const normalizedUrl = rawUrl.includes('://') ? rawUrl : `redis://${rawUrl}`;
    const url = new URL(normalizedUrl);
    const secureProtocol = ['ssl:', 'tls:', 'rediss:'].includes(url.protocol);
    const password = rawPassword || decodeURIComponent(url.password || '');

    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 9851,
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: password || undefined,
        tls: secureProtocol ? {} : undefined
    };
}

/**
 * Maintain a persistent connection to the configured Tile38 geofence server.
 * @class
 */
export default class ConnectionGeofence  {
    config: Config;
    tile38?: Tile38;
    state: GeofenceConnectionState;
    reconnectAttempts: number;
    reconnectTimer?: ReturnType<typeof setTimeout>;
    connectPromise?: Promise<void>;
    settings: GeofenceSettings;
    lastError?: Error;
    connectionVersion: number;
    closing: boolean;

    constructor(config: Config) {
        this.config = config;
        this.state = 'disconnected';
        this.reconnectAttempts = 0;
        this.settings = { ...DEFAULT_GEOFENCE_SETTINGS };
        this.connectionVersion = 0;
        this.closing = false;
    }

    async init(): Promise<void> {
        this.closing = false;
        await this.connect();
    }

    async refresh(): Promise<void> {
        this.closing = false;
        await this.connect();
    }

    async status(): Promise<GeofenceStatus> {
        const settings = await this.loadSettings();
        const url = settings['geofence::url'].trim();

        return {
            state: this.state,
            enabled: settings['geofence::enabled'],
            configured: settings['geofence::enabled'] && !!url,
            connected: this.state === 'connected',
            url,
            reconnectAttempts: this.reconnectAttempts,
            lastError: this.lastError?.message
        };
    }

    async close(): Promise<void> {
        this.closing = true;
        this.clearReconnectTimer();
        this.state = 'closing';
        this.reconnectAttempts = 0;
        this.lastError = undefined;

        await this.disconnectCurrentClient();

        this.state = 'disconnected';
    }

    private async loadSettings(): Promise<GeofenceSettings> {
        this.settings = await this.config.models.Setting.typedMany({
            ...DEFAULT_GEOFENCE_SETTINGS
        });

        return this.settings;
    }

    private async connect(): Promise<void> {
        if (this.connectPromise) {
            return this.connectPromise;
        }

        const connectPromise = this.connectInternal().finally(() => {
            if (this.connectPromise === connectPromise) {
                this.connectPromise = undefined;
            }
        });

        this.connectPromise = connectPromise;

        return connectPromise;
    }

    private async connectInternal(): Promise<void> {
        const settings = await this.loadSettings();
        const url = settings['geofence::url'].trim();

        if (!settings['geofence::enabled'] || !url) {
            await this.disable();
            return;
        }

        this.clearReconnectTimer();

        const client = new Tile38(buildTile38Options(url, settings['geofence::password'].trim()));
        const version = ++this.connectionVersion;

        this.attachListeners(client, version, url);

        const previous = this.tile38;
        this.tile38 = client;
        this.state = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';

        if (previous) {
            previous.removeAllListeners();
            await this.safeQuit(previous);
        }

        try {
            await client.ping();

            if (!this.isCurrentClient(client, version)) {
                await this.safeQuit(client);
                return;
            }

            this.state = 'connected';
            this.reconnectAttempts = 0;
            this.lastError = undefined;

            console.log(`ok - geofence connected: ${url}`);
        } catch (err) {
            if (!this.isCurrentClient(client, version)) {
                return;
            }

            this.lastError = toError(err);
            this.state = 'error';

            console.error(`not ok - geofence connect failed: ${this.lastError.message}`);
            this.scheduleReconnect('connect failure');
        }
    }

    private attachListeners(client: Tile38, version: number, url: string): void {
        client.on('connect', () => {
            if (!this.isCurrentClient(client, version)) return;
            console.log(`ok - geofence socket connected: ${url}`);
        }).on('ready', () => {
            if (!this.isCurrentClient(client, version)) return;

            this.state = 'connected';
            this.reconnectAttempts = 0;
            this.lastError = undefined;
        }).on('close', () => {
            this.handleDisconnect(client, version, 'close');
        }).on('end', () => {
            this.handleDisconnect(client, version, 'end');
        }).on('error', (err) => {
            if (!this.isCurrentClient(client, version)) return;

            this.lastError = toError(err);
            this.state = 'error';

            console.error(`not ok - geofence error: ${this.lastError.message}`);
            this.scheduleReconnect('error');
        });
    }

    private handleDisconnect(client: Tile38, version: number, source: 'close' | 'end'): void {
        if (!this.isCurrentClient(client, version)) return;

        if (this.closing) {
            this.state = 'disconnected';
            return;
        }

        this.state = 'disconnected';
        console.error(`not ok - geofence ${source}: lost connection`);
        this.scheduleReconnect(source);
    }

    private scheduleReconnect(reason: string): void {
        if (this.closing) return;

        const url = this.settings['geofence::url'].trim();
        if (!this.settings['geofence::enabled'] || !url) {
            this.state = 'disabled';
            return;
        }

        if (this.reconnectTimer) {
            return;
        }

        this.reconnectAttempts += 1;
        this.state = 'reconnecting';

        const retryMs = Math.min(30000, 1000 * Math.max(1, 2 ** (this.reconnectAttempts - 1)));

        console.log(`ok - geofence reconnect scheduled in ${retryMs}ms: ${reason}`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;

            void this.connect();
        }, retryMs);

        this.reconnectTimer.unref();
    }

    private clearReconnectTimer(): void {
        if (!this.reconnectTimer) return;

        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
    }

    private async disable(): Promise<void> {
        this.clearReconnectTimer();
        this.reconnectAttempts = 0;
        this.lastError = undefined;

        await this.disconnectCurrentClient();

        this.state = 'disabled';
    }

    private async disconnectCurrentClient(): Promise<void> {
        const current = this.tile38;

        this.tile38 = undefined;
        this.connectionVersion += 1;

        if (!current) {
            return;
        }

        current.removeAllListeners();
        await this.safeQuit(current);
    }

    private async safeQuit(client: Tile38): Promise<void> {
        try {
            await client.quit(true);
        } catch (err) {
            const error = toError(err);
            if (error.message !== 'Connection is closed.') {
                console.error(`not ok - geofence close failed: ${error.message}`);
            }
        }
    }

    private isCurrentClient(client: Tile38, version: number): boolean {
        return this.tile38 === client && this.connectionVersion === version;
    }
}
