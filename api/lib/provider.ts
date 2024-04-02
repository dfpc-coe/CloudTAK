import Config from './config.js';
import { Type } from '@sinclair/typebox'
import Err from '@openaddresses/batch-error';
import moment from 'moment';
import fetch from './fetch.js';
import { CookieJar } from 'tough-cookie';
import { CookieAgent } from 'http-cookie-agent/undici';
import { X509Certificate } from 'crypto';
import TAKAPI, { APIAuthPassword } from '../lib/tak-api.js';

export enum AuthProviderAccess {
    ADMIN = 'admin',
    AGENCY = 'agency',
    USER = 'user'
}

export default class AuthProvider {
    config: Config;
    cache?: {
        expires: Date;
        token: string;
    }

    constructor(config: Config) {
        this.config = config;
    }

    async external(username: string): Promise<{
        phone: string;
        system_admin: boolean;
        agency_admin: Array<number>;
    }> {
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
                phone: Type.String(),
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
            phone: user_body.data.phone,
            system_admin: user_body.data.roles.some((role) => role.name === 'System Administrator'),
            agency_admin: user_body.data.adminAgencies.map((a) => a.id)
        };
    }

    async login(username: string, password: string): Promise<string> {
        const url = new URL('/oauth/token', this.config.local ? 'http://localhost:5001' : this.config.MartiAPI);
        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', username);
        url.searchParams.append('password', password);

        const jar = new CookieJar();
        const agent = new CookieAgent({ cookies: { jar } });

        const authres = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            dispatcher: agent
        });

        if (!authres.ok) {
            throw new Err(500, new Error(`Status: ${authres.status}: ${await authres.text()}`), 'Non-200 Response from Auth Server - Token');
        }

        const body: any = await authres.json();

        if (body.error === 'invalid_grant' && body.error_description.startsWith('Bad credentials')) {
            throw new Err(400, null, 'Invalid Username or Password');
        } else if (body.error || !body.access_token) {
            throw new Err(500, new Error(body.error_description), 'Unknown Login Error');
        }

        if (this.config.AuthGroup) {
            const url = new URL('/Marti/api/groups/all?useCache=true', this.config.local ? 'http://localhost:5001' : this.config.MartiAPI);

            const groupres = await fetch(url, {
                credentials: 'include',
                dispatcher: agent
            });

            if (!groupres.ok) {
                throw new Err(500, new Error(`Status: ${groupres.status}: ${await groupres.text()}`), 'Non-200 Response from Auth Server - Groups');
            }

            const gbody: {
                data: Array<{
                    name: string;
                }>
            } = await groupres.json() as any;

            const groups = gbody.data.map((d: {
                name: string
            }) => {
                return d.name
            });

            if (!groups.includes(this.config.AuthGroup)) {
                throw new Err(403, null, 'Insufficient Group Privileges');
            }
        }

        const split = Buffer.from(body.access_token, 'base64').toString().split('}').map((ext) => { return ext + '}'});
        if (split.length < 2) throw new Err(500, null, 'Unexpected TAK JWT Format');
        const contents: { sub: string; aud: string; nbf: number; exp: number; iat: number; } = JSON.parse(split[1]);

        let profile;
        const api = await TAKAPI.init(new URL(this.config.MartiAPI), new APIAuthPassword(username, password));

        try {
            profile = await this.config.models.Profile.from(username);
        } catch (err) {
            if (err instanceof Error && err.status === 404) {
                await this.config.models.Profile.generate({
                    username: username,
                    auth: await api.Credentials.generate()
                });
            } else {
                throw new Err(400, null, err)
            }
        }

        let validTo;

        try {
            const cert = new X509Certificate(profile.auth.cert);

            validTo = cert.validTo
            // The validTo date looks like: 'Mar  6 20:38:58 2025 GMT'
            if (moment(validTo, "MMM DD hh:mm:ss YYYY").isBefore(moment().add(7, 'days'))) {
                throw new Error('Expired Certificate has expired or is about to');
            }
        } catch (err) {
            console.error(`Error: CertificateExpiration: ${validTo}: ${err}`);
            await this.config.models.Profile.commit(username, {
                auth: await api.Credentials.generate()
            });
        }

        return contents.sub;
    }
}
