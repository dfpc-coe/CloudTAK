import Config from './config.js';
import Err from '@openaddresses/batch-error';
import moment from 'moment';
import jwt from 'jsonwebtoken';
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

    constructor(config: Config) {
        this.config = config;
    }

    async external(username: string, password: string): Promise<void> {
        const url = new URL('/api/login', this.config.server.provider_url);

        const authres = await fetch(url, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                grant_type: 'password',
                client_id: parseInt(this.config.server.provider_client),
                client_secret: this.config.server.provider_secret,
                username,
                password
            })
        });

        console.error({
            grant_type: 'password',
            client_id: this.config.server.provider_client,
            client_secret: this.config.server.provider_secret,
            username,
            password
        });

        const body = await authres.text();
        console.error(body)
    }

    async login(username: string, password: string): Promise<{
        access: string;
        token: string;
        email: string;
    }> {
        const url = new URL('/oauth/token', this.config.local ? 'http://localhost:5001' : this.config.MartiAPI);
        url.searchParams.append('grant_type', 'password');
        url.searchParams.append('username', username);
        url.searchParams.append('password', password);

        const jar = new CookieJar();
        const agent = new CookieAgent({ cookies: { jar } });

        const authres = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            // @ts-expect-error
            dispatcher: agent
        });

        if (!authres.ok) {
            throw new Err(500, new Error(`Status: ${authres.status}: ${await authres.text()}`), 'Non-200 Response from Auth Server - Token');
        }

        const body = await authres.json();

        if (body.error === 'invalid_grant' && body.error_description.startsWith('Bad credentials')) {
            throw new Err(400, null, 'Invalid Username or Password');
        } else if (body.error || !body.access_token) {
            throw new Err(500, new Error(body.error_description), 'Unknown Login Error');
        }

        if (this.config.AuthGroup) {
            const url = new URL('/Marti/api/groups/all?useCache=true', this.config.local ? 'http://localhost:5001' : this.config.MartiAPI);

            const groupres = await fetch(url, {
                credentials: 'include',
                // @ts-expect-error
                dispatcher: agent
            });

            if (!groupres.ok) {
                throw new Err(500, new Error(`Status: ${groupres.status}: ${await groupres.text()}`), 'Non-200 Response from Auth Server - Groups');
            }

            const gbody: {
                data: Array<{
                    name: string;
                }>
            }= await groupres.json();

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
            if (err instanceof Err && err.status === 404) {
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

        return {
            access: 'user',
            token: jwt.sign({ access: 'user', email: contents.sub }, this.config.SigningSecret),
            email: contents.sub
        };
    }
}
