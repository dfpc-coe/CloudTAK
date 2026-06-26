import Dexie, { type EntityTable } from 'dexie';
import type {
    Feature,
    GroupChannel,
    Mission,
    MissionRole,
    MissionChange,
    MissionLayer,
    MissionLog,
    Contact,
    Server,
    ProfileOverlayList
} from './types.ts';

export interface DBIcon {
    /** Maplibre image id, e.g. "<iconsetUid>:<icon-path-without-extension>" */
    name: string;
    iconset: string;
    path: string;
    type2525b: string | null;
    updated: string;
    /**
     * Raw image bytes. Stored as an ArrayBuffer (not a Blob) to avoid the
     * WebKit/iOS IndexedDB bug that corrupts Blobs persisted in IndexedDB and
     * surfaces as "UnknownError: an internal error was encountered in the
     * Indexed Database server". Use `iconToBlob()` to reconstruct a Blob.
     */
    data: ArrayBuffer;
    /** MIME type of `data`, used to reconstruct a Blob on read. */
    mime: string;
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
    live: boolean;       // whether live breadcrumb recording is currently enabled
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
    username_internal: boolean;
    default_group: string | null;
    default_friendly: string | null;
    default_hostile: string | null;
    default_neutral: string | null;
    default_unknown: string | null;
    skip_resize: boolean;
}

export type DBOverlay = ProfileOverlayList["items"][number];

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

export interface DBKV {
    key: string;
    value: string;
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

export interface DBSubscriptionLayer {
    uid: string;
    mission: string;
    layer: MissionLayer;
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

export interface DBSubscriptionChat {
    id: string;
    mission: string;
    chatroom: string;
    sender: string;
    sender_uid: string;
    message: string;
    created: string;
    unread: boolean;
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

export interface DBSprite {
    /** Sprite id, e.g. 'default' */
    id: string;
    updated: number;
    /** MapLibre sprite layout JSON */
    json: Record<string, unknown>;
    /**
     * Spritesheet PNG bytes. Stored as an ArrayBuffer (not a Blob) to avoid the
     * WebKit/iOS IndexedDB Blob-corruption bug.
     */
    image: ArrayBuffer;
}

export type DatabaseType = Dexie & {
    icon: EntityTable<DBIcon, 'name'>,
    iconset: EntityTable<DBIconset, 'uid'>,
    overlay: EntityTable<DBOverlay, 'id'>,
    sprite: EntityTable<DBSprite, 'id'>,
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
    subscription_chat: EntityTable<DBSubscriptionChat, 'id'>,
    subscription_layer: EntityTable<DBSubscriptionLayer, 'uid'>,
    mission_template: EntityTable<DBMissionTemplate, 'id'>,
    mission_template_log: EntityTable<DBMissionTemplateLog, 'id'>,
    kv: EntityTable<DBKV, 'key'>,
    profile: EntityTable<DBProfileConfig, 'key'>,
    config: EntityTable<DBConfig, 'key'>,
    cache: EntityTable<DBCache, 'key'>,
    contact: EntityTable<Contact, 'uid'>
};

export const db = new Dexie('CloudTAK') as DatabaseType;

db.version(2).stores({
    kv: 'key',

    server: '_id',
    group: 'name, active',

    sprite: 'id',
    icon: 'name, iconset',
    iconset: 'uid, name',
    overlay: 'id, name, mode, mode_id',

    filter: 'id, external',
    video: 'id, username',
    feature: 'id, path',
    profile: 'key',
    contact: 'uid, callsign',
    config: 'key',
    cache: 'key',

    breadcrumb: 'id, uid, live',

    chatroom: 'id',
    chatroom_chats: 'id, chatroom',

    notification: 'id, type, name, body, url, created, toast, read',

    subscription: 'guid, name',
    subscription_log: 'id, [mission+id]',
    subscription_chat: 'id, mission, [mission+id]',
    subscription_feature: 'id, mission, [mission+id]',
    subscription_layer: 'uid, mission, [mission+uid]',
    subscription_contents: 'uid, mission, [mission+uid]',
    subscription_changes: '++id, mission',

    mission_template: 'id, name',
    mission_template_log: 'id, template, [template+id]',
});

// v3: migrate icon/sprite binary payloads from Blob to ArrayBuffer to avoid the
// WebKit/iOS IndexedDB "UnknownError" bug. The icon, iconset and sprite caches
// are cleared so they re-hydrate from the API in the new ArrayBuffer format, and
// the icon hydrate marker is removed so hydration re-runs on next launch.
db.version(3).stores({
    icon: 'name, iconset',
    iconset: 'uid, name',
    sprite: 'id',
}).upgrade(async (tx) => {
    await tx.table('icon').clear();
    await tx.table('iconset').clear();
    await tx.table('sprite').clear();
    await tx.table('cache').delete('iconsets:hydrated');
});

/**
 * Reconstruct a Blob from a cached icon. Icon bytes are persisted as an
 * ArrayBuffer (see {@link DBIcon}) to avoid the WebKit/iOS IndexedDB Blob bug,
 * so any consumer needing a Blob or object URL must rebuild it here.
 */
export function iconToBlob(icon: Pick<DBIcon, 'data' | 'mime'>): Blob {
    return new Blob([icon.data], { type: icon.mime });
}

/**
 * Detect the WebKit/iOS IndexedDB corruption error. On iOS WKWebView the
 * IndexedDB store can become corrupted, surfacing as "UnknownError: an internal
 * error was encountered in the Indexed Database server" (and occasionally as an
 * InvalidStateError when a connection is unexpectedly closed).
 */
export function isIndexedDBCorruptionError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = (err as { name?: string }).name ?? '';
    const message = String((err as { message?: string }).message ?? '');
    return (
        name === 'UnknownError'
        || name === 'InvalidStateError'
        || /internal error was encountered in the Indexed Database server/i.test(message)
    );
}

/**
 * Close, delete and recreate the local database. This is the only reliable
 * recovery from a corrupted IndexedDB on iOS WKWebView. It is safe here because
 * every table is either a rebuildable cache or re-fetched after login.
 */
export async function recreateDatabase(): Promise<void> {
    try {
        db.close();
    } catch {
        /* ignore close failures on an already-broken connection */
    }
    await db.delete();
    await db.open();
}

/**
 * Open the local database, recovering automatically from a corrupted IndexedDB
 * by deleting and recreating it. Call this before the first database access so
 * a corrupt store does not wedge app startup.
 */
export async function openDatabase(): Promise<void> {
    try {
        if (!db.isOpen()) await db.open();
    } catch (err) {
        if (!isIndexedDBCorruptionError(err)) throw err;
        console.error('Local database appears corrupted; recreating it', err);
        await recreateDatabase();
    }
}
