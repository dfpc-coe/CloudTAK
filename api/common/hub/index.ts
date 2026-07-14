import { Type } from '@sinclair/typebox';
import type CoT from '@tak-ps/node-cot';
import type { GeofenceStatus } from '../../stateful/lib/connection-geofence.js';

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

// TypeBox equivalents of the wire types above, used by the hub RPC routes
// (stateful/routes/) to validate and document the internal API

export const ConnStatusSchema = Type.String({
    enum: ['live', 'dead', 'unknown'],
});

export const PoolSummarySchema = Type.Object({
    dead: Type.Integer(),
    live: Type.Integer(),
    unknown: Type.Integer(),
});

export const PresenceMapSchema = Type.Record(Type.String(), Type.Object({
    active: Type.Boolean(),
    sessions: Type.Array(Type.String()),
}));

export const GeofenceStatusSchema = Type.Object({
    state: Type.String({
        enum: ['disabled', 'disconnected', 'connecting', 'connected', 'reconnecting', 'error', 'closing'],
    }),
    enabled: Type.Boolean(),
    configured: Type.Boolean(),
    connected: Type.Boolean(),
    url: Type.String(),
    reconnectAttempts: Type.Integer(),
    lastError: Type.Optional(Type.String()),
});

export type SubmitCotsRequest = {
    connection: number | string;
    cots: CoT[];
    write?: boolean;
    broadcast?: boolean;
    ensureProfile?: boolean;
    ifPooled?: boolean;
};

export interface HubClient {
    connectionSync(id: number, opts?: { force?: boolean; deleted?: boolean }): Promise<ConnStatus>;

    connectionStatus(ids: Array<number | string>): Promise<Record<string, ConnStatus>>;

    connectionSummary(): Promise<PoolSummary>;

    serverRefresh(opts?: { refreshAll?: boolean }): Promise<ConnStatus>;

    submitCots(req: SubmitCotsRequest): Promise<void>;

    wsNotify(key: string, payload: unknown, excludeSession?: string): Promise<void>;

    wsPresence(keys: string[]): Promise<PresenceMap>;

    eventSet(layerid: number, cron: string | null): Promise<void>;

    geofenceRefresh(): Promise<void>;

    geofenceStatus(): Promise<GeofenceStatus>;
}
