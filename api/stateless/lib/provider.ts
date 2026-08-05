import Config from '../../common/config.js';
import { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type { Profile } from '../../common/schema.js';
import { X509Certificate } from 'crypto';
import { TAKAPI, APIAuthPassword, APIAuthToken, APIAuthCertificate } from '@tak-ps/node-tak';
import UserControl from './control/user.js';

export enum AuthProviderAccess {
    ADMIN = 'admin',
    AGENCY = 'agency',
    USER = 'user',
}

export default class AuthProvider {
    config: Config;
    userControl: UserControl;

    constructor(config: Config) {
        this.config = config;
        this.userControl = new UserControl(config);
    }

    async login(username: string, password: string): Promise<string> {
        const auth = new APIAuthPassword(username, password);
        const api = await TAKAPI.init(new URL(this.config.server.webtak), auth);

        const contents = await api.OAuth.parse(auth.jwt);

        let profile;
        try {
            profile = await this.config.models.Profile.from(username);
        } catch (err) {
            if (err instanceof Error && err.message.includes('Item Not Found')) {
                profile = await this.userControl.generate({
                    username: username,
                    auth: await api.Credentials.generate(),
                });
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
            }
        }

        await this.valid(profile, password);

        return contents.sub;
    }

    /**
     * Login a user authenticated by an external OIDC provider - the bearer token
     * is only used to enroll a client certificate when one doesn't exist or is no
     * longer valid; an existing valid certificate is always reused
     */
    async loginOIDC(email: string, accessToken: string): Promise<InferSelectModel<typeof Profile>> {
        let profile;
        try {
            profile = await this.config.models.Profile.from(email);
        } catch (err) {
            if (err instanceof Error && err.message.includes('Item Not Found')) {
                profile = await this.userControl.generate({
                    username: email,
                    auth: await this.enroll(email, { token: accessToken }),
                });
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
            }
        }

        return await this.valid(profile, undefined, accessToken);
    }

    /**
     * Enroll a new client certificate with the TAK Server, authenticating with
     * either the user's password or an OIDC bearer token trusted by the TAK Server
     */
    async enroll(
        username: string,
        credentials: { password?: string; token?: string },
    ): Promise<{ ca: string[]; cert: string; key: string }> {
        let api;
        if (credentials.password !== undefined) {
            api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthPassword(username, credentials.password));
        } else if (credentials.token !== undefined) {
            api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthToken(credentials.token));
        } else {
            throw new Err(401, null, 'No credentials available to enroll a Certificate');
        }

        return await api.Credentials.generate({ username });
    }

    async valid(
        profile: InferSelectModel<typeof Profile>,
        password?: string,
        token?: string,
    ): Promise<InferSelectModel<typeof Profile>> {
        let validTo;

        try {
            const cert = new X509Certificate(profile.auth.cert);

            validTo = cert.validTo;
            const certExpiry = new Date(validTo);
            if (Number.isNaN(certExpiry.getTime()) || certExpiry.getTime() < Date.now() + (7 * 24 * 60 * 60 * 1000)) {
                throw new Error('Expired Certificate has expired or is about to');
            }
        } catch (err) {
            console.error(`Error: CertificateExpiration: ${validTo}: ${err}`);

            if (password || token) {
                profile = await this.config.models.Profile.commit(profile.username, {
                    auth: await this.enroll(profile.username, { password, token }),
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
            if (err instanceof Error && err.message.includes('org.springframework.security.authentication.BadCredentialsException')) {
                if (password || token) {
                    profile = await this.config.models.Profile.commit(profile.username, {
                        auth: await this.enroll(profile.username, { password, token }),
                    });
                } else {
                    throw new Err(401, err instanceof Error ? err : new Error(String(err)), 'Certificate is Revoked');
                }
            } else {
                throw err;
            }
        }

        return profile;
    }
}
