import { Tile38 } from '@iwpnd/tile38-ts';
import Config from './config.js';
import type ConnectionConfig from './connection-config.js';
import type { Feature } from 'geojson';
import { toError } from './error.js';

type GeofenceSettings = {
    'geofence::enabled': boolean;
    'geofence::url': string;
    'geofence::password': string;
};

type GeofenceConfig = GeofenceSettings & {
    url: string;
    configured: boolean;
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
        await this.refresh();
    }

    async refresh(): Promise<void> {
        this.closing = false;
        await this.connect();
    }

    async enabled(): Promise<boolean> {
        return (await this.loadSettings())['geofence::enabled'];
    }

    async load(connConfig: ConnectionConfig, features: Array<Feature>): Promise<void> {
        const settings = await this.configured();

        if (!settings.configured) {
            if (settings['geofence::enabled']) {
                console.error(`not ok - ${connConfig.id} - ${connConfig.name} - geofence server enabled but no URL configured`);
            }
            return;
        }

        if (!this.tile38 || this.state !== 'connected') {
            await this.connect();
        }

        if (!this.tile38 || this.state !== 'connected') {
            throw new Error('Geofence server is not connected');
        }

        const key = `cloudtak:geofence:${connConfig.id}`;
        const activeFeatures = features.filter((feature) => {
            if (feature.id !== undefined && feature.id !== null) return true;

            console.error(`not ok - ${connConfig.id} - ${connConfig.name} - skipping geofence without feature id`);
            return false;
        });
        const activeIds = new Set(activeFeatures.map((feature) => String(feature.id)));
        const existing = await this.tile38.scan(key).noFields().asIds();
        let removed = 0;

        for (const existingId of existing.ids) {
            const id = typeof existingId === 'string' ? existingId : existingId.id;
            if (activeIds.has(id)) continue;

            await this.tile38.del(key, id);
            removed += 1;
        }

        for (const feature of activeFeatures) {
            await this.tile38
                .set(key, String(feature.id))
                .object(feature)
                .exec();
        }

        console.log(`ok - ${connConfig.id} - ${connConfig.name} - synced ${activeFeatures.length} geofences, removed ${removed}`);
    }

    async status(): Promise<GeofenceStatus> {
        const settings = await this.configured();

        return {
            state: this.state,
            enabled: settings['geofence::enabled'],
            configured: settings.configured,
            connected: this.state === 'connected',
            url: settings.url,
            reconnectAttempts: this.reconnectAttempts,
            lastError: this.lastError?.message
        };
    }

    async close(): Promise<void> {
        this.closing = true;
        this.clearReconnectTimer();
        this.state = 'closing';
        this.resetStatus();

        await this.disconnectCurrentClient();

        this.state = 'disconnected';
    }

    private async loadSettings(): Promise<GeofenceSettings> {
        this.settings = await this.config.models.Setting.typedMany({
            ...DEFAULT_GEOFENCE_SETTINGS
        });

        return this.settings;
    }

    private async configured(): Promise<GeofenceConfig> {
        const settings = await this.loadSettings();
        const url = settings['geofence::url'].trim();

        return {
            ...settings,
            url,
            configured: settings['geofence::enabled'] && !!url
        };
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
        const settings = await this.configured();

        if (!settings.configured) {
            await this.disable();
            return;
        }

        this.clearReconnectTimer();

        const normalizedUrl = settings.url.includes('://') ? settings.url : `redis://${settings.url}`;
        const parsedUrl = new URL(normalizedUrl);
        const secureProtocol = ['ssl:', 'tls:', 'rediss:'].includes(parsedUrl.protocol);
        const password = settings['geofence::password'].trim() || decodeURIComponent(parsedUrl.password || '');
        const client = new Tile38({
            host: parsedUrl.hostname,
            port: parsedUrl.port ? Number(parsedUrl.port) : 9851,
            username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
            password: password || undefined,
            tls: secureProtocol ? {} : undefined
        });
        const version = ++this.connectionVersion;

        this.attachListeners(client, version, settings.url);

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

            this.markConnected();

            console.log(`ok - geofence connected: ${settings.url}`);
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

            this.markConnected();
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
        this.resetStatus();

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

    private markConnected(): void {
        this.state = 'connected';
        this.resetStatus();
    }

    private resetStatus(): void {
        this.reconnectAttempts = 0;
        this.lastError = undefined;
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
