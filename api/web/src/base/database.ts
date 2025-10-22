import Dexie, { type EntityTable } from 'dexie';
import type {
    Mission,
    MissionLog,
    MissionRole
} from '../types.ts';

interface DBSubscription {
    guid: string;
    name: string;
    subscribed: boolean;
    meta: Mission;
    role?: MissionRole;
    token?: string;
}

interface DBSubscriptionLog {
    id: string;
    dtf: string;
    created: string;
    mission: string;
    content: string;
    creatorUid: string;
    contentHashes: unknown[];
    keywords: string[];
}

export const db = new Dexie('CloudTAK') as Dexie & {
    subscription: EntityTable<DBSubscription, 'guid'>,
    subscription_log: EntityTable<DBSubscriptionLog, 'id'>
};

db.version(1).stores({
    subscription: 'guid, name, subscribed, meta, role, token',
    subscription_log: 'id, dtf, created, mission, content, creatorUid, contentHashes, keywords',
});

export type {
    DBSubscription,
    DBSubscriptionLog
}
