import Dexie, { type EntityTable } from 'dexie';
import type {
    Mission,
    MissionRole
} from '../types.ts';

export interface DBSubscription {
    guid: string;
    name: string;
    subscribed: boolean;
    meta: Mission;
    role?: MissionRole;
    token?: string;
}

export interface DBSubscriptionLog {
    id: string;
    dtg?: string;
    missionNames: string[],
    created: string;
    servertime: string,
    mission: string;
    content: string;
    creatorUid: string;
    contentHashes: unknown[];
    keywords: string[];
}

export type DatabaseType = Dexie & {
    subscription: EntityTable<DBSubscription, 'guid'>,
    subscription_log: EntityTable<DBSubscriptionLog, 'id'>
};

export function DatabaseInit() {
    const db = new Dexie('CloudTAK') as DatabaseType;

    db.version(1).stores({
        subscription: 'guid, name, subscribed, meta, role, token',
        subscription_log: 'id, dtf, created, mission, content, creatorUid, contentHashes, keywords, missionNames, servertime',
    });

    return db;
}
