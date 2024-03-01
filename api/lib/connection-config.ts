import { Connection } from './schema.js';
import { InferSelectModel } from 'drizzle-orm';
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

    subscriptions: () => Array<string>;
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

    async subscriptions(): Array<string> {
        return [];
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

    async subscriptions(): Array<string> {
        return [];
    }
}

