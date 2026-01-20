import Config from './config.js';
import { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import moment from 'moment';
import type { Profile } from './schema.js';
import { X509Certificate } from 'crypto';
import { TAKAPI, APIAuthPassword, APIAuthCertificate } from '@tak-ps/node-tak';
import ProfileControl from './control/profile.js';

export enum AuthProviderAccess {
    ADMIN = 'admin',
    AGENCY = 'agency',
    USER = 'user'
}

export default class AuthProvider {
    config: Config;
    profileControl: ProfileControl;

    constructor(config: Config) {
        this.config = config;
        this.profileControl = new ProfileControl(config);
    }

    async login(username: string, password: string): Promise<string> {
        const auth = new APIAuthPassword(username, password)
        const api = await TAKAPI.init(new URL(this.config.server.webtak), auth);

        const contents = await api.OAuth.parse(auth.jwt)

        let profile;
        try {
            profile = await this.config.models.Profile.from(username);
        } catch (err) {
            if (err instanceof Error && err.message.includes('Item Not Found')) {
                profile = await this.profileControl.generate({
                    username: username,
                    auth: await api.Credentials.generate()
                });
            } else {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err))
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
                const api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthPassword(profile.username, password));
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
            if (err instanceof Error && err.message.includes('org.springframework.security.authentication.BadCredentialsException')) {
                if (password) {
                    const api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthPassword(profile.username, password));
                    profile = await this.config.models.Profile.commit(profile.username, {
                        auth: await api.Credentials.generate()
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
