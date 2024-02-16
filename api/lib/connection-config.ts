import { Connection } from './schema.js';
import { InferSelectModel } from 'drizzle-orm';

export type ConnectionAuth = {
    cert: string;
    key: string;
}

export default interface ConnectionConfig {
    id: string | number;
    name: string;
    enabled: boolean;
    auth: ConnectionAuth;
}

export class MachineConnConfig implements ConnectionConfig {
    id: number;
    name: string;
    enabled: boolean;
    auth: ConnectionAuth;

    constructor(connection: InferSelectModel<typeof Connection>) {
        this.id = connection.id;
        this.name = connection.name;
        this.enabled = connection.enabled;
        this.auth = connection.auth;
    }
}

export class ProfileConnConfig implements ConnectionConfig {
    id: string;
    name: string;
    enabled: boolean;
    auth: ConnectionAuth;

    constructor(
        email: string,
        auth: ConnectionAuth
    ) {
        this.id = email;
        this.name = email;
        this.enabled = true;
        this.auth = auth;
    }
}

