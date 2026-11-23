import Err from '@openaddresses/batch-error';
import { TAKAPI, APIAuthCertificate, TAKServerError } from '@tak-ps/node-tak';
import type Config from '../config.js';
import { authenticatedProfile } from './profile.js';

export type CertAuth = {
    cert: string;
    key: string;
};

/** Outcome of probing TAK Server with a client certificate */
export type CertProbe = Awaited<ReturnType<TAKAPI['Certificate']['probe']>>;
/**
 * Does this error mean the TAK Server closed the connection instead of answering?
 * Under TLS 1.3 a rejected client certificate is only reported after the handshake
 * completes on the client side, so the failure surfaces as a closed socket
 * (UND_ERR_SOCKET: other side closed) rather than a TLS alert
 */
export function isSocketClose(err: unknown): boolean {
    return err instanceof Err
        && err.status === 400
        && !(err instanceof TAKServerError)
        && /UND_ERR_SOCKET|other side closed|socket hang up|EPIPE|ECONNRESET/i.test(String(err.message));
}
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

    /**
     * Is the TAK Server answering on its anonymous enrollment port (no client certificate)?
     * Any HTTP response counts - only a connection failure means the server is down
     */
    async enrollmentReachable(): Promise<boolean> {
        try {
            await fetch(new URL('/Marti/api/tls/config', String(this.config.server.webtak)), {
                signal: AbortSignal.timeout(5000),
            });
            return true;
        } catch {
            return false;
        }
    }
    /**
     * Ask TAK Server whether it accepts a client certificate. This is the one place that
     * decides "rejected" so SSO login, password login and token refresh agree.
     *
     * TAK Server answers a distrusted certificate by closing the socket, which Certificate.probe()
     * cannot tell from an outage. A closed socket is therefore reported as rejected only when the
     * anonymous enrollment port still answers, i.e. the server is up and only the certificate is
     * the problem. If that port is down too, the original error is rethrown (no re-enrollment).
     */
    async probeCertificate(auth: CertAuth): Promise<CertProbe> {
        const api = await this.withAuth(auth);
        try {
            return await api.Certificate.probe();
        } catch (err) {
            if (!isSocketClose(err) || !await this.enrollmentReachable()) throw err;
            return {
                accepted: false,
                reason: 'tls',
                message: err instanceof Error ? err.message : String(err),
            };
        }
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
