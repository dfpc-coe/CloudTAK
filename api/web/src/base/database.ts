import Dexie, { type EntityTable } from 'dexie';
import type {
    Feature,
    Mission,
    MissionRole,
    MissionChange,
    MissionLog
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

export interface DBChatroom {
    id: string;
    name: string;
    created: string;
    updated: string;
    last_read: string | null;
}

export interface DBChatroomChat {
    id: string;
    chatroom: string;
    sender: string;
    sender_uid: string;
    message: string;
    created: string;
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

export type DatabaseType = Dexie & {
    icon: EntityTable<DBIcon, 'name'>,
    iconset: EntityTable<DBIconset, 'uid'>,
    video: EntityTable<DBVideo, 'id'>,
    filter: EntityTable<DBFilter, 'id'>,
    feature: EntityTable<DBFeature, 'id'>,
    chatroom: EntityTable<DBChatroom, 'id'>,
    chatroom_chats: EntityTable<DBChatroomChat, 'id'>,
    notification: EntityTable<DBNotification, 'id'>,
    subscription: EntityTable<DBSubscription, 'guid'>,
    subscription_changes: EntityTable<DBSubscriptionChanges, 'id'>,
    subscription_log: EntityTable<DBSubscriptionLog, 'id'>,
    subscription_feature: EntityTable<DBSubscriptionFeature, 'id'>,
    mission_template: EntityTable<DBMissionTemplate, 'id'>,
    mission_template_log: EntityTable<DBMissionTemplateLog, 'id'>,
    profile: EntityTable<DBProfileConfig, 'key'>
};

export const db = new Dexie('CloudTAK') as DatabaseType;

db.version(1).stores({
    icon: 'name',
    iconset: 'uid, name',
    filter: 'id, external',
    video: 'id, username',
    feature: 'id, path',

    chatroom: 'id',
    chatroom_chats: 'id, chatroom',

    notification: 'id, type, name, body, url, created, toast, read',
    subscription: 'guid, name',
    subscription_log: 'id, [mission+id]',
    subscription_feature: 'id, mission, [mission+id]',
    subscription_changes: '++id, mission',
    mission_template: 'id, name',
    mission_template_log: 'id, template, [template+id]',
    profile: 'key'
});
