import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import type Config from '../config.js';
import { authenticatedProfile } from './profile.js';

export type CertAuth = {
    cert: string;
    key: string;
};

/** The client UID a CloudTAK user presents to TAK Server */
export function profileUid(username: string): string {
    return `ANDROID-CloudTAK-${username}`;
}

/**
 * Builds TAK Server API clients. Clients are cheap and not cached - one per request is the norm
 */
export default class TAKServerControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    url(): URL {
        return new URL(String(this.config.server.api));
    }

    async withAuth(auth: CertAuth): Promise<TAKAPI> {
        return await TAKAPI.init(this.url(), new APIAuthCertificate(auth.cert, auth.key));
    }

    /** As a CloudTAK user - rejects provisioned users that have not yet logged in */
    async asUser(username: string): Promise<TAKAPI> {
        const profile = await authenticatedProfile(this.config, username);
        return await this.withAuth(profile.auth);
    }

    /** As the server's own admin certificate */
    async asServer(): Promise<TAKAPI> {
        return await this.withAuth(this.config.serverCert());
    }

    /** As a Connection (or anything else carrying a certificate under `auth`) */
    async asConnection(connection: { auth: CertAuth }): Promise<TAKAPI> {
        return await this.withAuth(connection.auth);
    }
}
