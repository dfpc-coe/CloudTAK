import Config from './config.js';
import { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import moment from 'moment';
import fetch from './fetch.js';
import { CookieJar } from 'tough-cookie';
import type { Profile } from './schema.js';
import { CookieAgent } from 'http-cookie-agent/undici';
import { X509Certificate } from 'crypto';
import TAKAPI, { APIAuthPassword, APIAuthCertificate } from '../lib/tak-api.js';

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

        const split = Buffer.from(body.access_token, 'base64').toString().split('}').map((ext) => { return ext + '}'});
        if (split.length < 2) throw new Err(500, null, 'Unexpected TAK JWT Format');
        const contents: { sub: string; aud: string; nbf: number; exp: number; iat: number; } = JSON.parse(split[1]);

        let profile;
        try {
            profile = await this.config.models.Profile.from(username);
        } catch (err) {
            if (err instanceof Error && err.name === 'PublicError' && err.status === 404) {
                const api = await TAKAPI.init(new URL(this.config.MartiAPI), new APIAuthPassword(username, password));

                profile = await this.config.models.Profile.generate({
                    username: username,
                    auth: await api.Credentials.generate()
                });
            } else {
                throw new Err(400, err, err instanceof Error ? err.message : String(err))
            }
        }

        await this.valid(profile, password);

        return contents.sub;
    }

    async valid(
        profile: InferSelectModel<typeof Profile>,
        password?: string
    ): Promise<InferSelectModel<typeof Profile>> {
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

            if (password) {
                const api = await TAKAPI.init(new URL(this.config.MartiAPI), new APIAuthPassword(profile.username, password));
                profile = await this.config.models.Profile.commit(profile.username, {
                    auth: await api.Credentials.generate()
                });
            } else {
                throw new Err(401, null, 'Certificate is expired');
            }
        }

        const cert_api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

        try {
            // No "certificate validity" endpoint exists so make a common call
            // to ensure we get a 200 response and not a 500 - Update to check status when Josh
            // pushes a fix to throw a 401 instead of a 500 on bad certs
            await cert_api.Contacts.list();
        } catch (err) {
            if (err.message.includes('org.springframework.security.authentication.BadCredentialsException')) {
                if (password) {
                    const api = await TAKAPI.init(new URL(this.config.MartiAPI), new APIAuthPassword(profile.username, password));
                    profile = await this.config.models.Profile.commit(profile.username, {
                        auth: await api.Credentials.generate()
                    });
                } else {
                    throw new Err(401, null, 'Certificate is Revoked');
                }
            } else {
                throw err;
            }
        }

        return profile;
    }

}
