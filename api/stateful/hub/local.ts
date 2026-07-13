import Err from '@openaddresses/batch-error';
import WebSocket from 'ws';
import { MachineConnConfig, ProfileConnConfig, AdminConnConfig } from '../../common/connection-config.js';
import type { Connection } from '../../common/schema.js';
import type { InferSelectModel } from 'drizzle-orm';
import type { GeofenceStatus } from '../connection-geofence.js';
import type { HubClient, ConnStatus, PoolSummary, PresenceMap, SubmitCotsRequest } from '../../common/hub/index.js';
import type Config from '../../common/config.js';

export default class LocalHub implements HubClient {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async connectionSync(id: number, opts: { force?: boolean; deleted?: boolean } = {}): Promise<ConnStatus> {
        if (opts.deleted) {
            this.config.conns.delete(id);
            return this.config.conns.status(id);
        }

        let connection: InferSelectModel<typeof Connection> | undefined;
        try {
            connection = await this.config.models.Connection.from(id);
        } catch (err) {
            if (err instanceof Error && 'status' in err && err.status === 404) {
                connection = undefined;
            } else {
                throw err;
            }
        }

        if (!connection || !connection.enabled) {
            this.config.conns.delete(id);
        } else {
            if (opts.force && this.config.conns.has(id)) {
                this.config.conns.delete(id);
            }

            if (!this.config.conns.has(id)) {
                await this.config.conns.add(new MachineConnConfig(this.config, connection));
            }
        }

        return this.config.conns.status(id);
    }

    async connectionStatus(ids: Array<number | string>): Promise<Record<string, ConnStatus>> {
        const statuses: Record<string, ConnStatus> = {};

        for (const id of ids) {
            statuses[String(id)] = this.config.conns.status(id);
        }

        return statuses;
    }

    async connectionSummary(): Promise<PoolSummary> {
        const summary: PoolSummary = { dead: 0, live: 0, unknown: 0 };

        for (const conn of this.config.conns.values()) {
            summary[this.config.conns.status(conn.config.id)]++;
        }

        return summary;
    }

    async serverRefresh(opts: { refreshAll?: boolean } = {}): Promise<ConnStatus> {
        this.config.server = await this.config.models.Server.from(this.config.server.id);

        if (opts.refreshAll) {
            await this.config.conns.refresh();

            for (const [key, clients] of [...this.config.wsClients.entries()]) {
                if (/^\d+$/.test(key)) continue;

                for (const client of [...clients]) {
                    client.ws.close(1000, 'Server Configuration Changed');
                }
            }

            return this.config.conns.status(0);
        }

        this.config.conns.delete(0);

        if (this.config.server.connection && this.config.server.auth.cert && this.config.server.auth.key) {
            await this.config.conns.add(new AdminConnConfig(this.config));
        }

        return this.config.conns.status(0);
    }

    async submitCots(req: SubmitCotsRequest): Promise<void> {
        let client = this.config.conns.get(req.connection);

        if (!client && req.ensureProfile && typeof req.connection === 'string') {
            const profile = await this.config.models.Profile.from(req.connection);

            if (!profile.auth || !profile.auth.cert || !profile.auth.key) {
                throw new Err(400, null, 'Profile auth certificate not configured');
            }

            client = await this.config.conns.add(new ProfileConnConfig(this.config, req.connection, profile.auth));

            await client.awaitSecure();
        }

        if (!client) {
            if (req.ifPooled) return;
            throw new Err(200, null, 'Received but Connection Paused');
        }

        if (req.write !== false) {
            client.tak.write(req.cots, { stripFlow: true });
        }

        if (req.broadcast) {
            this.config.conns.cots(client.config, req.cots).catch((err) => {
                console.error(`Error: Failed to broadcast CoTs for ${req.connection}:`, err);
            });
        }
    }

    async wsNotify(key: string, payload: unknown, excludeSession?: string): Promise<void> {
        const clients = this.config.wsClients.get(key) || [];
        if (!clients.length) return;

        const raw = JSON.stringify(payload);

        for (const client of clients) {
            if (excludeSession && client.session && client.session === excludeSession) continue;
            if (client.ws.readyState !== WebSocket.OPEN) continue;

            try {
                client.ws.send(raw);
            } catch (err) {
                console.error(`Error: Failed to send event to client of ${key}:`, err);
            }
        }
    }

    async wsPresence(keys: string[]): Promise<PresenceMap> {
        const presence: PresenceMap = {};

        for (const key of keys) {
            const clients = this.config.wsClients.get(key) || [];

            presence[key] = {
                active: clients.length > 0,
                sessions: clients
                    .map(client => client.session)
                    .filter((session): session is string => session !== undefined),
            };
        }

        return presence;
    }

    async eventSet(layerid: number, cron: string | null): Promise<void> {
        if (cron) {
            await this.config.events.add(layerid, cron);
        } else {
            await this.config.events.delete(layerid);
        }
    }

    async geofenceRefresh(): Promise<void> {
        await this.config.geofence.refresh();
    }

    async geofenceStatus(): Promise<GeofenceStatus> {
        return await this.config.geofence.status();
    }
}
