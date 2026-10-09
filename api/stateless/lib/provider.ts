import type ConfigStateless from '../config.js';
import { InferSelectModel } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import type { Profile } from '../../common/schema.js';
import { X509Certificate } from 'crypto';
import type { Static } from '@sinclair/typebox';
import type { CertificateResponse } from '../../common/types.js';
import { TAKAPI, APIAuthPassword } from '@tak-ps/node-tak';
import type { CertificateValidation } from '@tak-ps/node-tak/lib/api/certificate';
import UserControl from './control/user.js';
import TAKServerControl from '../../common/control/takserver.js';

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
    config: ConfigStateless;
    userControl: UserControl;

    constructor(config: ConfigStateless) {
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

    /**
     * The hub's pooled connection reconnects with the certificate it was built with -
     * drop it so the next WebSocket rebuilds from the regenerated credentials.
     * Best effort: an unreachable hub must not fail the login
     */
    async profileSync(username: string): Promise<void> {
        try {
            await this.config.hub.profileSync(username);
        } catch (err) {
            console.error(`Error: ProfileSync: ${username}: ${err instanceof Error ? err.message : String(err)}`);
        }
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

        if (profile.disabled) throw new Err(403, null, 'User is disabled - Contact your administrator');

        await this.valid(profile, password);

        return contents.sub;
    }

    async valid(
        profile: InferSelectModel<typeof Profile>,
        password?: string,
    ): Promise<InferSelectModel<typeof Profile>> {
        let auth = profile.auth;

        if (!auth || AuthProvider.certificateRenewalRequired(auth.cert)) {
            if (auth) {
                console.error(`Error: CertificateExpiration: ${profile.username}: ${AuthProvider.certificate(auth.cert)?.validTo ?? 'unparseable'}: Certificate has expired or is about to`);
            }

            if (password) {
                const api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthPassword(profile.username, password));
                auth = await api.Credentials.generate();
                profile = await this.config.models.Profile.commit(profile.username, { auth });
                await this.profileSync(profile.username);
            } else if (auth) {
                throw new Err(401, null, 'Certificate is expired');
            } else {
                throw new Err(401, null, 'User has been provisioned but has not yet logged in');
            }
        }

        const cert_api = await new TAKServerControl(this.config).withAuth(auth);

        // The TAK Server X509 filter runs on every request so a GET of the anonymous, DB-free
        // version endpoint is the cheapest authoritative check that the certificate is still
        // accepted (revocation, trust) - non-authentication errors are rethrown by probe()
        const probe = await cert_api.Certificate.probe();

        if (!probe.accepted) {
            console.error(`Error: CertificateRejected: ${profile.username}: ${probe.reason}: ${probe.message}`);

            if (password) {
                const api = await TAKAPI.init(new URL(this.config.server.webtak), new APIAuthPassword(profile.username, password));
                profile = await this.config.models.Profile.commit(profile.username, {
                    auth: await api.Credentials.generate(),
                });
                await this.profileSync(profile.username);
            } else {
                let message = 'Certificate was rejected by the TAK Server';

                if (probe.reason === 'revoked') {
                    message = 'Certificate is Revoked';

                    // Best effort - the admin certificate lookup adds the revocation date to the message
                    try {
                        const status = await this.status(auth.cert);
                        if (status?.revocationDate) message = `Certificate was revoked on ${status.revocationDate}`;
                    } catch (err) {
                        console.error(err);
                    }
                } else if (probe.reason === 'tls') {
                    message = 'Certificate is expired or not trusted by the TAK Server';
                }

                throw new Err(401, new Error(probe.message ?? probe.reason), message);
            }
        }

        return profile;
    }

    /**
     * Look up a certificate's TAK Server record (expiry & revocation) via the Admin certificate
     *
     * Returns undefined if the server has not been configured with an Admin certificate
     */
    async status(cert: string): Promise<Static<typeof CertificateValidation> | undefined> {
        if (!this.config.server.auth.cert || !this.config.server.auth.key) return undefined;

        const api = await new TAKServerControl(this.config).asServer();

        return await api.Certificate.validate(cert);
    }
}
