import Config from './config.js'
import { Static, Type } from '@sinclair/typebox';
import CoTAKUser from './user/cotak.js';

export const Agency = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.Any()
});

export const Integration = Type.Object({
    id: Type.Number(),
    name: Type.String(),
});

export const MachineUser = Type.Object({
    id: Type.Number(),
    email: Type.String(),
    integrations: Type.Array(Integration),
});

export const Channel = Type.Object({
    id: Type.Number(),
    rdn: Type.String(),
    name: Type.String(),
    description: Type.Any()
});

export enum ChannelAccessEnum {
    write = 'write',
    read = 'read',
    duplex = 'duplex'
}

export const ChannelAccess = Type.Enum(ChannelAccessEnum);

export interface UserInterface {
    _id: string;
    _name: string;
    _config: Config;

    configured: boolean;

    createMachineUser(uid: number, body: {
        name: string;
        agency_id?: number;
        password: string;
        integration: {
            name: string;
            description: string;
            management_url: string;
            active: boolean;
        }
    }): Promise<Static<typeof MachineUser>>;

    fetchMachineUser(uid: number, email: string): Promise<Static<typeof MachineUser>>;

    updateMachineUser(
        uid: number,
        mid: number,
        body: {
            name?: string;
            email?: string;
            active?: boolean;
            password?: string;
        }
    ): Promise<Static<typeof MachineUser>>;

    attachMachineUser(uid: number, body: {
        machine_id: number;
        channel_id: number;
        access: ChannelAccessEnum;
    }): Promise<void>;

    updateIntegrationConnectionId(uid: number, body: {
        integration_id: number;
        connection_id: number;
    }): Promise<void>;

    deleteIntegrationByConnectionId(uid: number, body: {
        connection_id: number;
    }): Promise<void>;

    agency(uid: number, agency_id: number): Promise<Static<typeof Agency>>;

    channels(uid: number, query: {
        filter: string;
        agency?: number;
    }): Promise<{
        total: number;
        items: Array<Static<typeof Channel>>
    }>;

    agencies(uid: number, filter: string): Promise<{
        total: number;
        items: Array<Static<typeof Agency>>
    }>;

    login(username: string): Promise<{
        id: number;
        name: string;
        phone: string | null;
        system_admin: boolean;
        agency_admin: Array<number>;
    }>;
}

export class UserManager {
    config: Config;
    services: Map<string, UserInterface>;

    constructor(config: Config) {
        this.config = config;
        this.services = new Map();
    }

    async init() {
        const cotak = await CoTAKUser.init(this.config);
        this.services.set(cotak._id, cotak);
    }

    get(id: string): UserInterface {
        const service = this.services.get(id);
        if (!service) throw new Error(`User Service: ${id} not found`);
        return service;
    }

    list(): Array<{ id: string, name: string }> {
        const list = [];
        for (const service of this.services.values()) {
            list.push({
                id: service._id,
                name: service._name
            });
        }
        return list;
    }
}
