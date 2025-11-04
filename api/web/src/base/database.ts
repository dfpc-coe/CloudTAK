import Dexie, { type EntityTable } from 'dexie';
import type {
    Feature,
    Mission,
    MissionRole
} from '../types.ts';

export interface DBIcon {
    name: string;
}

export interface DBNotification {
    id: string;
    type: string;
    name: string;
    body: string;
    url: string;
    toast: boolean;
    read: boolean;
    created: string;
}

export interface DBSubscriptionFeature {
    id: string;
    path: string;
    mission: string;
    properties: Feature["properties"];
    geometry: Feature["geometry"];
}

export interface DBSubscription {
    guid: string;
    name: string;
    meta: Mission;
    role: MissionRole;
    token?: string;

    dirty: boolean;
    subscribed: boolean;
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
    icon: EntityTable<DBIcon, 'name'>,
    notification: EntityTable<DBNotification, 'id'>,
    subscription: EntityTable<DBSubscription, 'guid'>,
    subscription_log: EntityTable<DBSubscriptionLog, 'id'>
    subscription_feature: EntityTable<DBSubscriptionFeature, 'id'>,
};

export const db = new Dexie('CloudTAK') as DatabaseType;

db.version(1).stores({
    icon: 'name',
    notification: 'id, type, name, body, url, created, toast, read',
    subscription: 'guid, name, meta, role, token, subscribed, dirty',
    subscription_log: 'id, dtf, created, mission, content, creatorUid, contentHashes, keywords, missionNames, servertime',
    subscription_feature: 'id, path, mission, properties, geometry',
});
