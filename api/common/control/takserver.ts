import Err from '@openaddresses/batch-error';
import { TAKAPI, APIAuth, APIAuthCertificate, TAKServerError } from '@tak-ps/node-tak';
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
/**
 * Does a raw transport error (before node-tak wraps it) look like TAK Server refusing our client
 * certificate - a closed socket or a TLS alert - rather than the server being unreachable?
 */
export function isTransportRejection(err: unknown): boolean {
    const parts: string[] = [];
    for (let e: unknown = err; e instanceof Error && parts.length < 5; e = e.cause) {
        parts.push((e as { code?: string }).code ?? '', e.message);
    }
    return /UND_ERR_SOCKET|other side closed|socket hang up|EPIPE|ECONNRESET|ERR_SSL|alert|certificate/i.test(parts.join(' '));
}
/**
 * Client certificate auth for the server's own admin certificate. When TAK Server rejects the
 * certificate (rotated or replaced PKI) it reloads the certificate from Secrets Manager and retries once
 */
class AdminCertificateAuth extends APIAuthCertificate {
    config: Config;
    constructor(config: Config) {
        const { cert, key } = config.serverCert();
        super(cert, key);
        this.config = config;
    }
    async fetch(api: Parameters<APIAuth['fetch']>[0], url: Parameters<APIAuth['fetch']>[1], opts: Parameters<APIAuth['fetch']>[2]) {
        try {
            return await super.fetch(api, url, opts);
        } catch (err) {
            if (!isTransportRejection(err)) throw err;
            // Another call may have reloaded the certificate while this one was in flight
            const current = this.config.serverCert();
            const stale = current.cert !== this.cert || current.key !== this.key;
            if (!stale && !await this.config.reloadAdminCert('rejected')) throw err;
            const next = this.config.serverCert();
            this.cert = next.cert;
            this.key = next.key;
            return await super.fetch(api, url, opts);
        }
    }
}
/** The client UID a CloudTAK user presents to TAK Server */
export function profileUid(username: string): string {
    return `ANDROID-CloudTAK-${username}`;
}

/** The callsign a CloudTAK user presents to TAK Server */
export async function profileCallsign(config: Config, username: string): Promise<string> {
    const configs = await config.models.ProfileConfig.from(username);
    const callsign = configs['tak::callsign'];
    return typeof callsign === 'string' && callsign ? callsign : 'CloudTAK User';
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
        return await TAKAPI.init(this.url(), new AdminCertificateAuth(this.config));
    }

    /** As a Connection (or anything else carrying a certificate under `auth`) */
    async asConnection(connection: { auth: CertAuth }): Promise<TAKAPI> {
        return await this.withAuth(connection.auth);
    }
}
