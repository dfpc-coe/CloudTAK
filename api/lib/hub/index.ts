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
