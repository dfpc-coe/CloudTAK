import fetch from './fetch.js';
import Err from '@openaddresses/batch-error';
import Config from './config.js'
import { Static, Type } from '@sinclair/typebox';

export const Agency = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.Any()
});

export const Channel = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    description: Type.Any()
});

export default class ExternalProvider {
    config: Config;
    cache?: {
        expires: Date;
        token: string;
    }

    constructor(config: Config) {
        this.config = config;
    }

    async auth(): Promise<void> {
        if (!this.cache || this.cache.expires < new Date()) {
            const expires = new Date();
            const authres = await fetch(new URL(`/oauth/token`, this.config.server.provider_url), {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    "scope": "admin-system",
                    "grant_type":  "client_credentials",
                    "client_id": parseInt(this.config.server.provider_client),
                    "client_secret": this.config.server.provider_secret,
                })
            });

            if (!authres.ok) throw new Err(500, new Error(await authres.text()), 'Internal Provider Token Generation Error');
            const cache = await authres.typed(Type.Object({
                token_type: Type.String(),
                expires_in: Type.Integer(),
                access_token: Type.String()
            }));

            const token = cache.access_token;
            expires.setSeconds(expires.getSeconds() + cache.expires_in - 120);

            this.cache = { token, expires };
        }
    }

    async createMachineUser(uid: number, body: {
        name: string;
        agency_id: number;
        password: string;
    }): Promise<Static<typeof Agency>> {
        await this.auth();

        const url = new URL(`api/v1/proxy/machine-users`, this.config.server.provider_url);
        url.searchParams.append('proxy_user_id', String(uid));
        const agencyres = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${this.cache.token}`
            },
            body: JSON.stringify({
                ...body,
                active: true
            })
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Agency
        }));

        return list.data;
    }

    async agency(uid: number, agency_id: number): Promise<Static<typeof Agency>> {
        await this.auth();

        const url = new URL(`/api/v1/proxy/agencies/${agency_id}`, this.config.server.provider_url);
        url.searchParams.append('proxy_user_id', String(uid));
        const agencyres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${this.cache.token}`
            },
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Agency
        }));

        return list.data;
    }

    async channels(uid: number, filter: string): Promise<{
        total: number;
        items: Array<Static<typeof Channel>>
    }> {
        await this.auth();

        const url = new URL(`/api/v1/proxy/channels`, this.config.server.provider_url);
        url.searchParams.append('proxy_user_id', String(uid));
        url.searchParams.append('filter', filter);

        const channelres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${this.cache.token}`
            },
        });

        if (!channelres.ok) throw new Err(500, new Error(await channelres.text()), 'External Channel List Error');

        const list = await channelres.typed(Type.Object({
            data: Type.Array(Channel),
            meta: Type.Object({
                current_page: Type.Integer(),
                last_page: Type.Integer(),
                per_page: Type.Integer(),
                total: Type.Integer()
            })
        }));

        return {
            total: list.meta.total,
            items: list.data
        }
    }

    async agencies(uid: number, filter: string): Promise<{
        total: number;
        items: Array<Static<typeof Agency>>
    }> {
        await this.auth();

        const url = new URL(`/api/v1/proxy/agencies`, this.config.server.provider_url);
        url.searchParams.append('proxy_user_id', String(uid));
        url.searchParams.append('filter', filter);

        const agencyres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${this.cache.token}`
            },
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Type.Array(Agency),
            meta: Type.Object({
                current_page: Type.Integer(),
                last_page: Type.Integer(),
                per_page: Type.Integer(),
                total: Type.Integer()
            })
        }));

        return {
            total: list.meta.total,
            items: list.data
        }
    }

    async login(username: string): Promise<{
        id: number;
        name: string;
        phone: string | null;
        system_admin: boolean;
        agency_admin: Array<number>;
    }> {
        await this.auth();

        const userres = await fetch(new URL(`/api/v1/server/users/email/${encodeURIComponent(username)}`, this.config.server.provider_url), {
            method: 'GET',
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${this.cache.token}`
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'Internal Provider Lookup Error');

        const user_body = await userres.typed(Type.Object({
            data: Type.Object({
                id: Type.Integer(),
                name: Type.String(),
                email: Type.String(),
                phone: Type.Union([Type.String(), Type.Null()]),
                active: Type.Boolean(),
                agencies: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String(),
                    active: Type.Boolean()
                })),
                adminAgencies: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String(),
                    active: Type.Boolean()
                })),
                roles: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String()
                }))
            })
        }));

        return {
            id: user_body.data.id,
            name: user_body.data.name,
            phone: user_body.data.phone,
            system_admin: user_body.data.roles.some((role) => role.name === 'System Administrator'),
            agency_admin: user_body.data.adminAgencies.map((a) => a.id)
        };
    }
}
