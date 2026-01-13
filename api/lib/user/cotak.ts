import fetch from '../fetch.js';
import Err from '@openaddresses/batch-error';
import Config from '../config.js'
import { Static, Type } from '@sinclair/typebox';
import {
    UserInterface,
    MachineUser,
    Agency,
    Channel,
    ChannelAccessEnum
} from '../interface-user.js';

export const CoTAKUserConfig = Type.Object({
    url: Type.String(),
    client: Type.String(),
    secret: Type.String()
})

export default class CoTAKUser implements UserInterface {
    _id = 'cotak';
    _name = 'CoTAK User Provider';
    _config: Config;
    provider: Static<typeof CoTAKUserConfig>;
    cache?: {
        expires: Date;
        token: string;
    }

    constructor(
        config: Config,
        provider: Static<typeof CoTAKUserConfig>
    ) {
        this._config = config;
        this.provider = provider;
    }

    get configured(): boolean {
        return !!(this.provider.url && this.provider.secret && this.provider.client);
    }

    static async init(config: Config): Promise<CoTAKUser> {
        const final: Record<string, string> = {};
        (await Promise.allSettled(([
            'provider::url',
            'provider::client',
            'provider::secret'
        ].map((key) => {
            return config.models.Setting.from(key);
        })))).forEach((k) => {
            if (k.status === 'rejected') return;
            return final[k.value.key] = String(k.value.value);
        });

        return new CoTAKUser(config, {
            url: final['provider::url'] || '',
            client: final['provider::client'] || '',
            secret: final['provider::secret'] || '',
        } as Static<typeof CoTAKUserConfig>)
    }

    async auth(): Promise<{
        expires: Date;
        token: string;
    }> {
        if (!this.cache || this.cache.expires < new Date()) {
            const expires = new Date();
            const authres = await fetch(new URL(`/oauth/token`, this.provider.url), {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    "scope": "admin-system",
                    "grant_type":  "client_credentials",
                    "client_id": parseInt(this.provider.client),
                    "client_secret": this.provider.secret,
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

            const res = { token, expires };
            this.cache = res;

            return res;
        } else {
            return this.cache;
        }
    }

    async createMachineUser(uid: number, body: {
        name: string;
        description: string;
        management_url: string;
        active: boolean;
        locking: boolean;
        agency_id: number;
        password: string;
        channels: Array<{
            id: number;
            access: ChannelAccessEnum;
        }>;
    }): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/integrations/etl`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));

        const req = {
            name: body.name,
            description: body.description,
            management_url: body.management_url,
            agency_id: body.agency_id,
            active: body.active,
            machine_user: {
                name: body.name,
                password: body.password,
                active: true,
                is_channel_locking: body.locking
            }
        }

        const intres = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                "Authorization": `Bearer ${creds.token}`
            },
            body: JSON.stringify(req)
        });

        if (!intres.ok) throw new Err(500, new Error(await intres.text()), 'External Integration Creation Error');

        const integration_body = await intres.typed(Type.Object({
            data: Type.Object({
                id: Type.Integer()
            })
        }));

        const murl = new URL(`api/v1/proxy/machine-users/integration/${integration_body.data.id}`, this.provider.url);
        murl.searchParams.append('proxy_user_id', String(uid));

        const musres = await fetch(murl, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${creds.token}`
            },
        });

        if (!musres.ok) throw new Err(500, new Error(await musres.text()), 'External Machine User Fetch Error');

        const mus = await musres.typed(Type.Object({
            data: Type.Array(MachineUser)
        }))

        if (!mus.data.length) throw new Err(404, null, 'Machine User Not Found');

        const user = mus.data[0];

        for (const channel of body.channels) {
            const url = new URL(`api/v1/proxy/channels/${channel.id}/machine-users/attach/${user.id}`, this.provider.url);
            url.searchParams.append('proxy_user_id', String(uid));

            url.searchParams.append('sync', 'true')
            url.searchParams.append('access_type', channel.access)

            const userres = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${creds.token}`
                }
            });

            if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Attachment Error');
        }

        return user;
    }

    async fetchMachineUser(uid: number, email: string): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/machine-users/email/${email}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));

        const userres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${creds.token}`
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Creation Error');

        const user = await userres.typed(Type.Object({
            data: MachineUser
        }))

        return user.data;
    }


    async updateMachineUser(
        uid: number,
        body: {
            id?: number;
            name?: string;
            email?: string;
            active?: boolean;
            password?: string;
            integration_id?: number;
            connection_id?: number;
        }
    ): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        if (body.integration_id && body.connection_id) {
            const url = new URL(`api/v1/proxy/integrations/etl/${body.integration_id}`, this.provider.url);
            url.searchParams.append('proxy_user_id', String(uid));

            const req = {
                management_url: this._config.API_URL + `/connection/${body.connection_id}`,
                external_identifier: body.connection_id,
                active: true,
            }

            const userres = await fetch(url, {
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${creds.token}`
                },
                body: JSON.stringify(req)
            });

            if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Integration Update Error');
        }

        if (!body.id && body.integration_id) {
            const murl = new URL(`api/v1/proxy/machine-users/integration/${body.integration_id}`, this.provider.url);
            murl.searchParams.append('proxy_user_id', String(uid));

            const musres = await fetch(murl, {
                headers: {
                    Accept: 'application/json',
                    "Authorization": `Bearer ${creds.token}`
                },
            });

            if (!musres.ok) throw new Err(500, new Error(await musres.text()), 'External Machine User Fetch Error');

            const mus = await musres.typed(Type.Object({
                data: Type.Array(MachineUser)
            }))

            if (mus.data.length) body.id = mus.data[0].id;
        }

        if (body.id) {
            const url = new URL(`api/v1/proxy/machine-users/${body.id}`, this.provider.url);
            url.searchParams.append('proxy_user_id', String(uid));

            const hasUpdate = body.name || body.email || body.active !== undefined || body.password;

            if (hasUpdate) {
                const req = {
                    name: body.name,
                    email: body.email,
                    active: body.active,
                    password: body.password
                };

                const userres = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        Accept: 'application/json',
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${creds.token}`
                    },
                    body: JSON.stringify(req)
                });
        
                if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Update Error');
        
                const user = await userres.typed(Type.Object({
                    data: MachineUser
                }))
        
                return user.data;
            } else {
                const userres = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${creds.token}`
                    }
                });
        
                if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Fetch Error');
        
                const user = await userres.typed(Type.Object({
                    data: MachineUser
                }))
        
                return user.data;
            }
        }
        
        throw new Err(500, null, 'Could not determine Machine User ID to Update');
    }

    async deleteMachineUser(uid: number, body: {
        connection_id: number;
    }): Promise<void> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/integrations/etl/identifier/${body.connection_id}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));
        url.searchParams.append('delete_machine_user', 'true');

        await fetch(url, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                "Authorization": `Bearer ${creds.token}`
            }
        });

        return;
    }

    async agency(uid: number, agency_id: number): Promise<Static<typeof Agency>> {
        const creds = await this.auth();

        const url = new URL(`/api/v1/proxy/agencies/${agency_id}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));
        const agencyres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${creds.token}`
            },
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Agency
        }));

        return list.data;
    }

    async channels(uid: number, query: {
        filter: string;
        agency?: number;
    }): Promise<{
        total: number;
        items: Array<Static<typeof Channel>>
    }> {
        const creds = await this.auth();

        let url: URL;
        if (query.agency) {
            url = new URL(`api/v1/proxy/agencies/${query.agency}/channels`, this.provider.url);
            url.searchParams.append('proxy_user_id', String(uid));
            url.searchParams.append('filter', query.filter);
        } else {
            url = new URL(`/api/v1/proxy/channels`, this.provider.url);
            url.searchParams.append('proxy_user_id', String(uid));
            url.searchParams.append('filter', query.filter);
        }

        const channelres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${creds.token}`
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
        const creds = await this.auth();

        const url = new URL(`/api/v1/proxy/agencies`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));
        url.searchParams.append('filter', filter);

        const agencyres = await fetch(url, {
            headers: {
                Accept: 'application/json',
                "Authorization": `Bearer ${creds.token}`
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
        const creds = await this.auth();

        const userres = await fetch(new URL(`/api/v1/server/users/email/${encodeURIComponent(username)}`, this.provider.url), {
            method: 'GET',
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${creds.token}`
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'Internal Provider Lookup Error');

        const user_body = await userres.typed(Type.Object({
            data: Type.Object({
                id: Type.Integer(),
                name: Type.String(),
                email: Type.String(),
                phone: Type.Union([Type.Null(), Type.String()]),
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
            phone: user_body.data.phone || '',
            system_admin: user_body.data.roles.some((role) => role.name === 'System Administrator'),
            agency_admin: user_body.data.adminAgencies.map((a) => a.id)
        };
    }
}
