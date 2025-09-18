import { Static, Type } from '@sinclair/typebox';
import type { Connection } from './schema.js';
import { X509Certificate } from 'crypto';
import { InferSelectModel, sql } from 'drizzle-orm';
import Config from './config.js';

export const ConnectionAuth = Type.Object({
    ca: Type.Optional(Type.Array(Type.String())),
    cert: Type.String({
        minLength: 1,
        maxLength: 4096,
        description: 'PEM formatted client certificate'
    }),
    key: Type.String({
        minLength: 1,
        maxLength: 4096,
        description: 'PEM formatted private key'
    })
});

export type MissionSub = {
    name: string;
    token: string | null;
}

export default interface ConnectionConfig {
    id: string | number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: Config;

    subscription: (name: string) => Promise<null | MissionSub>;
    subscriptions: () => Promise<Array<MissionSub>>;

    uid(): string;
}

export class MachineConnConfig implements ConnectionConfig {
    id: number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: Config;

    constructor(config: Config, connection: InferSelectModel<typeof Connection>) {
        this.config = config;
        this.id = connection.id;
        this.name = connection.name;
        this.enabled = connection.enabled;
        this.auth = connection.auth;
    }

    uid(): string {
        const cert = new X509Certificate(this.auth.cert);

        const subject = cert.subject.split('\n').reverse().join(',');

        return subject;
    }

    async subscription(name: string): Promise<null | MissionSub> {
        const missions = await this.config.models.Data.list({
            where: sql`
                name = ${name}
                AND connection = ${this.id}::INT
                AND mission_sync IS True
            `
        });

        if (missions.items.length === 0) {
            return null;
        }

        return {
            name: missions.items[0].name,
            token: missions.items[0].mission_token
        };
    }

    async subscriptions(): Promise<Array<MissionSub>> {
        const missions = await this.config.models.Data.list({
            where: sql`
                connection = ${this.id}::INT
                AND mission_sync IS True
            `
        });

        return missions.items.map((m) => {
            return { name: m.name, token: m.mission_token }
        });
    }
}

export class ProfileConnConfig implements ConnectionConfig {
    id: string;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: Config;

    constructor(
        config: Config,
        email: string,
        auth: Static<typeof ConnectionAuth>
    ) {
        this.config = config;
        this.id = email;
        this.name = email;
        this.enabled = true;
        this.auth = auth;
    }

    uid(): string {
        return `ANDROID-CloudTAK-${this.id}`;
    }

    async subscription(name: string): Promise<null | MissionSub> {
        const missions = await this.config.models.ProfileOverlay.list({
            where: sql`
                name = ${name}
                AND mode = 'mission'
                AND username = ${this.id}
            `
        });

        if (missions.items.length === 0) {
            return null;
        }

        return {
            name: missions.items[0].name,
            token: missions.items[0].token
        };
    }

    async subscriptions(): Promise<Array<MissionSub>> {
        const missions = await this.config.models.ProfileOverlay.list({
            where: sql`
                mode = 'mission'
                AND username = ${this.id}
            `
        });

        return missions.items.map((m) => {
            return { name: m.name, token: m.token }
        })
    }
}

