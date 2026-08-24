import Config from '../../common/config.js';
import { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type { Profile } from '../../common/schema.js';
import { X509Certificate } from 'crypto';
import type { Static } from '@sinclair/typebox';
import type { CertificateResponse } from '../../common/types.js';
import { TAKAPI, APIAuthPassword, APIAuthCertificate } from '@tak-ps/node-tak';
import UserControl from './control/user.js';

/**
 * Certificates expiring within this window are treated as requiring renewal
 */
export const CERT_RENEWAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

    /**
     * Public metadata for a PEM certificate or undefined if the certificate cannot be parsed
     */
    static certificate(cert: unknown): Static<typeof CertificateResponse> | undefined {
        if (typeof cert !== 'string' || !cert.length) return undefined;

        try {
            const { subject, validFrom, validTo } = new X509Certificate(cert);
            return { subject, validFrom, validTo };
        } catch {
            return undefined;
        }
    }

    /**
     * True if the certificate cannot be parsed or has already expired
     */
    static certificateExpired(cert: unknown, now = Date.now()): boolean {
        const info = AuthProvider.certificate(cert);
        if (!info) return true;

        const expiry = Date.parse(info.validTo);
        return Number.isNaN(expiry) || expiry < now;
    }

    /**
     * True if the certificate cannot be parsed, has expired, or expires within CERT_RENEWAL_WINDOW_MS
     */
    static certificateRenewalRequired(cert: unknown, now = Date.now()): boolean {
        return AuthProvider.certificateExpired(cert, now + CERT_RENEWAL_WINDOW_MS);
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

    async valid(
        profile: InferSelectModel<typeof Profile>,
        password?: string,
    ): Promise<InferSelectModel<typeof Profile>> {
        if (AuthProvider.certificateRenewalRequired(profile.auth.cert)) {
            console.error(`Error: CertificateExpiration: ${profile.username}: ${AuthProvider.certificate(profile.auth.cert)?.validTo ?? 'unparseable'}: Certificate has expired or is about to`);

            if (password) {
                const api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthPassword(profile.username, password));
                profile = await this.config.models.Profile.commit(profile.username, {
                    auth: await api.Credentials.generate(),
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
                        auth: await api.Credentials.generate(),
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
