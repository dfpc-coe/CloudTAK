import type CoT from '@tak-ps/node-cot';
import type { GeofenceStatus } from '../connection-geofence.js';

export type ConnStatus = 'live' | 'dead' | 'unknown';

export type PoolSummary = {
    dead: number;
    live: number;
    unknown: number;
};

export type PresenceMap = Record<string, {
    active: boolean;
    sessions: string[];
}>;

export type SubmitCotsRequest = {
    connection: number | string;

    /**
     * CoTs to submit - passed by reference in-process; remote HubClient
     * implementations serialize to CoT XML on the wire
     */
    cots: CoT[];

    /** Write the CoTs to the TAK Server TCP connection (default true) */
    write?: boolean;

    /** Fan the CoTs out to Sinks & the submitter's WebSocket clients */
    broadcast?: boolean;

    /**
     * If the (email-keyed) profile connection isn't pooled yet, create it
     * and wait for the TLS handshake before writing
     */
    ensureProfile?: boolean;

    /** Silently no-op when the connection isn't pooled instead of erroring */
    ifPooled?: boolean;
};

/**
 * Boundary between the stateless REST API and the stateful server (TAK
 * connection pool, browser WebSockets, layer cron scheduler, geofence).
 *
 * Routes must interact with stateful resources exclusively through this
 * interface: in single-process deployments it is backed by direct in-process
 * calls (LocalHub), in split deployments by RPC to the stateful server.
 */
export interface HubClient {
    /**
     * Reconcile the pooled TAK connection for a Machine Connection with its
     * database row: connect if enabled, disconnect if disabled or deleted.
     * `force` tears down an existing pooled connection first (used after
     * auth/URL changes and for explicit refreshes).
     */
    connectionSync(id: number, opts?: { force?: boolean }): Promise<ConnStatus>;

    connectionStatus(ids: Array<number | string>): Promise<Record<string, ConnStatus>>;

    connectionSummary(): Promise<PoolSummary>;

    /**
     * Re-read the Server row and reconcile the admin connection (id 0)
     * with its enabled/auth state
     */
    serverRefresh(): Promise<ConnStatus>;

    submitCots(req: SubmitCotsRequest): Promise<void>;

    /** Send a JSON payload to all of a user's connected WebSocket clients */
    wsNotify(key: string, payload: unknown, excludeSession?: string): Promise<void>;

    /** Report which of the given users/connections have connected WebSocket clients */
    wsPresence(keys: string[]): Promise<PresenceMap>;

    /** Schedule (cron) or remove (null) the second-level event cron for a layer */
    eventSet(layerid: number, cron: string | null): Promise<void>;

    geofenceRefresh(): Promise<void>;

    geofenceStatus(): Promise<GeofenceStatus>;
}
