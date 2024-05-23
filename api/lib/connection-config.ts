import { Connection } from './schema.js';
import DataMission from './data-mission.js';
import { InferSelectModel, sql } from 'drizzle-orm';
import Config from './config.js';

export type ConnectionAuth = {
    cert: string;
    key: string;
}

export default interface ConnectionConfig {
    id: string | number;
    name: string;
    enabled: boolean;
    auth: ConnectionAuth;
    config: Config;

    subscriptions: () => Promise<Array<string>>;
}

export class MachineConnConfig implements ConnectionConfig {
    id: number;
    name: string;
    enabled: boolean;
    auth: ConnectionAuth;
    config: Config;

    constructor(config: Config, connection: InferSelectModel<typeof Connection>) {
        this.config = config;
        this.id = connection.id;
        this.name = connection.name;
        this.enabled = connection.enabled;
        this.auth = connection.auth;
    }

    async subscriptions(): Promise<Array<string>> {
        const missions = await this.config.models.Data.list({
            where: sql`
                connection = ${this.id}::INT
                AND mission_sync IS True
            `
        });

        for (const data of missions.items) {
            try {
                await DataMission.sync(this.config, data);
            } catch (err) {
                console.error('Failed DataMission.sync:', err);
            }
        }

        return missions.items.map((m) => {
            return m.name;
        })
    }
}

export class ProfileConnConfig implements ConnectionConfig {
    id: string;
    name: string;
    enabled: boolean;
    auth: ConnectionAuth;
    config: Config;

    constructor(
        config: Config,
        email: string,
        auth: ConnectionAuth
    ) {
        this.config = config;
        this.id = email;
        this.name = email;
        this.enabled = true;
        this.auth = auth;
    }

    async subscriptions(): Promise<Array<string>> {
        const missions = await this.config.models.ProfileOverlay.list({
            where: sql`
                mode = 'mission'
                AND username = ${this.id}
            `
        });

        return missions.items.map((m) => {
            return m.name;
        })
    }
}

