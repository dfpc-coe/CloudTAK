import Dexie, { type EntityTable } from 'dexie';
import type {
    Feature,
    GroupChannel,
    Mission,
    MissionRole,
    MissionChange,
    MissionLog,
    Contact,
    Server
} from '../types.ts';

export interface DBIcon {
    name: string;
}

export interface DBFeature {
    id: string;
    path: string;
    properties: Feature["properties"];
    geometry: Feature["geometry"];
}

export interface DBBreadcrumb {
    id: string;          // `${uid}.track`
    uid: string;         // the source CoT UID being tracked
    path: string;
    callsign: string;
    color?: string;
    coordinates: number[][];
}

export interface DBChatroom {
    id: string;
    name: string;
    created: string;
    updated: string;
    unread?: number;
    last_read: string | null;
}

export interface DBChatroomChat {
    id: string;
    chatroom: string;
    sender: string;
    sender_uid: string;
    message: string;
    created: string;
    unread?: boolean;
}

export interface DBIconset {
    uid: string;
    created: string;
    updated: string;
    version: number;
    name: string;
    username: string | null;
    default_group: string | null;
    default_friendly: string | null;
    default_hostile: string | null;
    default_neutral: string | null;
    default_unknown: string | null;
    skip_resize: boolean;
}

export interface DBFilter {
    id: string;
    external: string;
    name: string;
    source: string;
    internal: boolean;
    query: string;
}

export enum NotificationType {
    Contact = 'Contact',
    Import = 'Import',
    Alert = 'Alert',
    Medical = 'Medical',
    Mission = 'Mission',
    Chat = 'Chat'
}

export interface DBNotification {
    id: string;
    type: NotificationType;
    name: string;
    body: string;
    url: string;
    toast: boolean;
    read: boolean;
    created: string;
}

export interface DBVideo {
    id: string;
    created: string;
    updated: string;
    lease: number;
    username: string;
}

export interface DBSubscriptionFeature {
    id: string;
    path: string;
    mission: string;
    properties: Feature["properties"];
    geometry: Feature["geometry"];
}

export interface DBSubscriptionContent {
    uid: string;
    mission: string;
    timestamp: string;
    creatorUid?: string;
    keywords: string[];
    name: string;
    hash: string;
    submissionTime: string;
    size: number;
    mimeType?: string;
    submitter?: string;
    expiration: number;
}

export interface DBSubscriptionChanges extends MissionChange {
    id?: number;
    mission: string;
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

export interface DBSubscriptionLog extends MissionLog {
    mission: string;
    read: boolean;
}

export interface DBMissionTemplate {
    id: string;
    name: string;
    icon: string;
    description: string;
    created: string;
    updated: string;
}

export interface DBMissionTemplateLog {
    id: string;
    template: string;
    name: string;
    icon?: string | null;
    description: string;
    created: string;
    updated: string;
    schema: unknown;
    keywords: string[];
}

export interface DBProfileConfig {
    key: string;
    value: unknown;
}

export interface DBConfig {
    key: string;
    value: unknown;
}

export interface DBServer extends Server {
    _id: string;
}

export interface DBCache {
    key: string;
    updated: number;
}

export type DatabaseType = Dexie & {
    icon: EntityTable<DBIcon, 'name'>,
    iconset: EntityTable<DBIconset, 'uid'>,
    group: EntityTable<GroupChannel, 'name'>,
    video: EntityTable<DBVideo, 'id'>,
    filter: EntityTable<DBFilter, 'id'>,
    feature: EntityTable<DBFeature, 'id'>,
    breadcrumb: EntityTable<DBBreadcrumb, 'id'>,
    chatroom: EntityTable<DBChatroom, 'id'>,
    chatroom_chats: EntityTable<DBChatroomChat, 'id'>,
    notification: EntityTable<DBNotification, 'id'>,
    subscription: EntityTable<DBSubscription, 'guid'>,
    subscription_contents: EntityTable<DBSubscriptionContent, 'uid'>,
    subscription_changes: EntityTable<DBSubscriptionChanges, 'id'>,
    server: EntityTable<DBServer, '_id'>,
    subscription_log: EntityTable<DBSubscriptionLog, 'id'>,
    subscription_feature: EntityTable<DBSubscriptionFeature, 'id'>,
    mission_template: EntityTable<DBMissionTemplate, 'id'>,
    mission_template_log: EntityTable<DBMissionTemplateLog, 'id'>,
    profile: EntityTable<DBProfileConfig, 'key'>,
    config: EntityTable<DBConfig, 'key'>,
    cache: EntityTable<DBCache, 'key'>,
    contact: EntityTable<Contact, 'uid'>
};

export const db = new Dexie('CloudTAK') as DatabaseType;

db.version(1).stores({
    icon: 'name',
    server: '_id',
    group: 'name, active',
    iconset: 'uid, name',
    filter: 'id, external',
    video: 'id, username',
    feature: 'id, path',
    profile: 'key',
    contact: 'uid, callsign',
    config: 'key',
    cache: 'key',

    breadcrumb: 'id, uid',

    chatroom: 'id',
    chatroom_chats: 'id, chatroom',

    notification: 'id, type, name, body, url, created, toast, read',

    subscription: 'guid, name',
    subscription_log: 'id, [mission+id]',
    subscription_feature: 'id, mission, [mission+id]',
    subscription_contents: 'uid, mission, [mission+uid]',
    subscription_changes: '++id, mission',

    mission_template: 'id, name',
    mission_template_log: 'id, template, [template+id]',
});
