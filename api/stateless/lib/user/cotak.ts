import { fetch } from '@tak-ps/node-safeurl';
import Err from '@openaddresses/batch-error';
import Config from '../../../common/config.js';
import { Static, Type } from '@sinclair/typebox';
import {
    UserInterface,
    MachineUser,
    Agency,
    Channel,
    ChannelAccessEnum,
} from '../interface-user.js';

export const CoTAKUserConfig = Type.Object({
    url: Type.String(),
    client: Type.String(),
    secret: Type.String(),
});

export default class CoTAKUser implements UserInterface {
    _id = 'cotak';
    _name = 'CoTAK User Provider';
    _config: Config;
    provider: Static<typeof CoTAKUserConfig>;
    cache?: {
        expires: Date;
        token: string;
    };

    constructor(
        config: Config,
        provider: Static<typeof CoTAKUserConfig>,
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
            'provider::secret',
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
        } as Static<typeof CoTAKUserConfig>);
    }

    async auth(): Promise<{
        expires: Date;
        token: string;
    }> {
        if (!this.cache || this.cache.expires < new Date()) {
            const expires = new Date();
            const authres = await fetch(new URL(`/oauth/token`, this.provider.url), {
                method: 'POST',
                safeUrlAllow: [this.provider.url],
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    scope: 'admin-system',
                    grant_type: 'client_credentials',
                    client_id: this.provider.client,
                    client_secret: this.provider.secret,
                }),
            });

            if (!authres.ok) throw new Err(500, new Error(await authres.text()), 'Internal Provider Token Generation Error');

            const cache = await authres.typed(Type.Object({
                token_type: Type.String(),
                expires_in: Type.Integer(),
                access_token: Type.String(),
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
        agency_id?: number;
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
            agency_id: body.agency_id || null,
            active: body.active,
            machine_user: {
                name: body.name,
                password: body.password,
                active: true,
                is_channel_locking: body.locking,
            },
        };

        const intres = await fetch(url, {
            method: 'POST',
            safeUrlAllow: [this.provider.url],
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.token}`,
            },
            body: JSON.stringify(req),
        });

        if (!intres.ok) throw new Err(500, new Error(await intres.text()), 'External Integration Creation Error');

        const integration_body = await intres.typed(Type.Object({
            data: Type.Object({
                id: Type.Integer(),
            }),
        }));

        const murl = new URL(`api/v1/proxy/machine-users/integration/${integration_body.data.id}`, this.provider.url);
        murl.searchParams.append('proxy_user_id', String(uid));

        const musres = await fetch(murl, {
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
            },
        });

        if (!musres.ok) throw new Err(500, new Error(await musres.text()), 'External Machine User Fetch Error');

        const mus = await musres.typed(Type.Object({
            data: Type.Array(MachineUser),
        }));

        if (!mus.data.length) throw new Err(404, null, 'Machine User Not Found');

        const user = mus.data[0];

        for (const channel of body.channels) {
            await this.attachMachineUserChannel(uid, user.id, channel);
        }

        return user;
    }

    async attachMachineUserChannel(uid: number, user_id: number, channel: {
        id: number;
        access: ChannelAccessEnum;
    }): Promise<void> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/channels/${channel.id}/machine-users/attach/${user_id}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));

        url.searchParams.append('sync', 'true');
        url.searchParams.append('access_type', channel.access);

        const userres = await fetch(url, {
            method: 'GET',
            safeUrlAllow: [this.provider.url],
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.token}`,
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Attachment Error');
    }

    async detachMachineUserChannel(uid: number, user_id: number, channel_id: number): Promise<void> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/channels/${channel_id}/machine-users/detach/${user_id}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));

        url.searchParams.append('sync', 'true');

        const userres = await fetch(url, {
            method: 'GET',
            safeUrlAllow: [this.provider.url],
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.token}`,
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Detachment Error');
    }

    async fetchMachineUserChannels(uid: number, connection_id: number): Promise<{
        user: Static<typeof MachineUser>;
        channels: Array<Static<typeof Channel>>;
    }> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/integrations/etl/identifier/${connection_id}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));

        const intres = await fetch(url, {
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
            },
        });

        if (intres.status === 404) throw new Err(404, null, 'Connection is not managed by a Machine User');
        if (!intres.ok) throw new Err(500, new Error(await intres.text()), 'External Integration Fetch Error');

        const integration = await intres.typed(Type.Object({
            data: Type.Object({
                id: Type.Integer(),
                name: Type.String(),
                machineUsers: Type.Array(Type.Object({
                    id: Type.Number(),
                    email: Type.String(),
                    channels: Type.Array(Channel),
                })),
            }),
        }));

        const user = integration.data.machineUsers[0];
        if (!user) throw new Err(404, null, 'Connection is not managed by a Machine User');

        return {
            user: {
                id: user.id,
                email: user.email,
                integrations: [{
                    id: integration.data.id,
                    name: integration.data.name,
                }],
            },
            channels: user.channels,
        };
    }

    async updateMachineUserChannels(uid: number, connection_id: number, body: {
        attach: Array<{
            id: number;
            access: ChannelAccessEnum;
        }>;
        detach: Array<number>;
    }): Promise<{
        user: Static<typeof MachineUser>;
        channels: Array<Static<typeof Channel>>;
    }> {
        const { user, channels } = await this.fetchMachineUserChannels(uid, connection_id);

        const current = new Set(channels.map(channel => channel.id));
        const detach = new Set(body.detach);
        const attach = new Map(body.attach.map(channel => [channel.id, channel]));

        if (attach.size !== body.attach.length) throw new Err(400, null, 'Channels can only be attached once');

        for (const id of detach) {
            if (!current.has(id)) throw new Err(400, null, `Machine User is not a member of Channel ${id}`);
        }

        // A channel present in both lists is a request to change the access type of an existing membership
        for (const id of attach.keys()) {
            if (current.has(id) && !detach.has(id)) throw new Err(400, null, `Machine User is already a member of Channel ${id}`);
        }

        const remaining = new Set([...current].filter(id => !detach.has(id)));
        for (const id of attach.keys()) remaining.add(id);
        if (!remaining.size) throw new Err(400, null, 'Machine User must remain a member of at least one Channel');

        // New channels are attached first so a failure part way through cannot leave the user without any channels
        for (const channel of attach.values()) {
            if (detach.has(channel.id)) continue;
            await this.attachMachineUserChannel(uid, user.id, channel);
        }

        for (const id of detach) {
            await this.detachMachineUserChannel(uid, user.id, id);

            const channel = attach.get(id);
            if (channel) await this.attachMachineUserChannel(uid, user.id, channel);
        }

        return await this.fetchMachineUserChannels(uid, connection_id);
    }

    async fetchMachineUser(uid: number, email: string): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        const url = new URL(`api/v1/proxy/machine-users/email/${email}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));

        const userres = await fetch(url, {
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
            },
        });

        if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Creation Error');

        const user = await userres.typed(Type.Object({
            data: MachineUser,
        }));

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
        },
    ): Promise<Static<typeof MachineUser>> {
        const creds = await this.auth();

        if (body.integration_id && body.connection_id) {
            const url = new URL(`api/v1/proxy/integrations/etl/${body.integration_id}`, this.provider.url);
            url.searchParams.append('proxy_user_id', String(uid));

            const req = {
                management_url: this._config.API_URL + `/connection/${body.connection_id}`,
                external_identifier: body.connection_id,
                active: true,
            };

            const userres = await fetch(url, {
                method: 'PATCH',
                safeUrlAllow: [this.provider.url],
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${creds.token}`,
                },
                body: JSON.stringify(req),
            });

            if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Integration Update Error');
        }

        if (!body.id && body.integration_id) {
            const murl = new URL(`api/v1/proxy/machine-users/integration/${body.integration_id}`, this.provider.url);
            murl.searchParams.append('proxy_user_id', String(uid));

            const musres = await fetch(murl, {
                safeUrlAllow: [this.provider.url],
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${creds.token}`,
                },
            });

            if (!musres.ok) throw new Err(500, new Error(await musres.text()), 'External Machine User Fetch Error');

            const mus = await musres.typed(Type.Object({
                data: Type.Array(MachineUser),
            }));

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
                    password: body.password,
                };

                const userres = await fetch(url, {
                    method: 'PATCH',
                    safeUrlAllow: [this.provider.url],
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${creds.token}`,
                    },
                    body: JSON.stringify(req),
                });

                if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Update Error');

                const user = await userres.typed(Type.Object({
                    data: MachineUser,
                }));

                return user.data;
            } else {
                const userres = await fetch(url, {
                    method: 'GET',
                    safeUrlAllow: [this.provider.url],
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${creds.token}`,
                    },
                });

                if (!userres.ok) throw new Err(500, new Error(await userres.text()), 'External Machine User Fetch Error');

                const user = await userres.typed(Type.Object({
                    data: MachineUser,
                }));

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
        url.searchParams.append('delete_machine_users', 'true');

        await fetch(url, {
            method: 'DELETE',
            safeUrlAllow: [this.provider.url],
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${creds.token}`,
            },
        });

        return;
    }

    async agency(uid: number, agency_id: number): Promise<Static<typeof Agency>> {
        const creds = await this.auth();

        const url = new URL(`/api/v1/proxy/agencies/${agency_id}`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));
        const agencyres = await fetch(url, {
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
            },
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Agency,
        }));

        return list.data;
    }

    async channels(uid: number, query: {
        filter: string;
        agency?: number;
    }): Promise<{
        total: number;
        items: Array<Static<typeof Channel>>;
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
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
            },
        });

        if (!channelres.ok) throw new Err(500, new Error(await channelres.text()), 'External Channel List Error');

        const list = await channelres.typed(Type.Object({
            data: Type.Array(Channel),
            meta: Type.Object({
                current_page: Type.Integer(),
                last_page: Type.Integer(),
                per_page: Type.Integer(),
                total: Type.Integer(),
            }),
        }));

        return {
            total: list.meta.total,
            items: list.data,
        };
    }

    async agencies(uid: number, filter: string): Promise<{
        total: number;
        items: Array<Static<typeof Agency>>;
    }> {
        const creds = await this.auth();

        const url = new URL(`/api/v1/proxy/agencies`, this.provider.url);
        url.searchParams.append('proxy_user_id', String(uid));
        url.searchParams.append('filter', filter);

        const agencyres = await fetch(url, {
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
            },
        });

        if (!agencyres.ok) throw new Err(500, new Error(await agencyres.text()), 'External Agency List Error');
        const list = await agencyres.typed(Type.Object({
            data: Type.Array(Agency),
            meta: Type.Object({
                current_page: Type.Integer(),
                last_page: Type.Integer(),
                per_page: Type.Integer(),
                total: Type.Integer(),
            }),
        }));

        return {
            total: list.meta.total,
            items: list.data,
        };
    }

    async login(username: string): Promise<{
        id: number;
        name: string;
        phone: string;
        system_admin: boolean;
        agency_admin: Array<number>;
    }> {
        const creds = await this.auth();

        const userres = await fetch(new URL(`/api/v1/server/users/email/${encodeURIComponent(username)}`, this.provider.url), {
            method: 'GET',
            safeUrlAllow: [this.provider.url],
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${creds.token}`,
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
                    active: Type.Boolean(),
                })),
                adminAgencies: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String(),
                    active: Type.Boolean(),
                })),
                roles: Type.Array(Type.Object({
                    id: Type.Integer(),
                    name: Type.String(),
                })),
            }),
        }));

        return {
            id: user_body.data.id,
            name: user_body.data.name,
            phone: user_body.data.phone || '',
            system_admin: user_body.data.roles.some(role => role.name === 'System Administrator'),
            agency_admin: user_body.data.adminAgencies.map(a => a.id),
        };
    }
}
