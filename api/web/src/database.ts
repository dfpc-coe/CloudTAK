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
    data: Blob;
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
    /** Spritesheet PNG */
    image: Blob;
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

/*
 * iOS/WebKit background-suspend resilience
 *
 * When iOS suspends a backgrounded WebView (or Capacitor app) it can force-close
 * the underlying IndexedDB connection and abort any in-flight transactions.
 * Dexie does not auto-reopen after such a close, so the next read/write rejects
 * with DatabaseClosedError / AbortError — surfaced to the user as
 * "Transaction Aborted" when the app is resumed.
 *
 * Strategy:
 *  1. A Dexie DBCore middleware wraps every table operation so each call
 *     transparently reopens the connection before proceeding when closed.
 *     When the database is already open (the normal case) the check is a
 *     synchronous `isOpen()` call — zero async overhead.
 *  2. `ensureDbOpen()` is exported for callers that want to batch-reopen once
 *     before a burst of writes (e.g. WebSocket reconnect on resume).
 *  3. `withDbRetry()` is exported for idempotent writes that should retry if a
 *     transaction is aborted mid-flight (distinct from a closed connection).
 */

let reopenPromise: Promise<void> | null = null;

function reopenDatabase(): Promise<void> {
    if (db.isOpen()) return Promise.resolve();

    if (!reopenPromise) {
        reopenPromise = (async () => {
            for (let attempt = 0; attempt < 5; attempt++) {
                if (db.isOpen()) return;

                try {
                    await db.open();
                    return;
                } catch (err) {
                    if (db.isOpen()) return;
                    console.warn(`Dexie reopen attempt ${attempt + 1} failed:`, err);
                    await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
                }
            }
        })().finally(() => {
            reopenPromise = null;
        });
    }

    return reopenPromise;
}

// Proactively reopen whenever WebKit force-closes the connection on background suspend.
db.on('close', () => {
    void reopenDatabase();
});

const TRANSIENT_DB_ERROR_NAMES = new Set([
    'AbortError',
    'DatabaseClosedError',
    'PrematureCommitError',
    'TransactionInactiveError',
    'InvalidStateError',
    'UnknownError'
]);

// Low-level middleware: every DBCore operation ensures the connection is open
// and retries on transient errors (AbortError / DatabaseClosedError etc.).
// Covers chained queries (where/equals/toArray etc.) as well as direct calls
// since all Dexie operations ultimately pass through these six methods.
db.use({
    stack: 'dbcore',
    create(downlevel) {
        async function wrap<T>(fn: () => Promise<T>): Promise<T> {
            if (!db.isOpen()) await reopenDatabase();

            let lastError: unknown;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    return await fn();
                } catch (err) {
                    lastError = err;
                    const name = (err as { name?: string } | null)?.name ?? '';
                    if (!TRANSIENT_DB_ERROR_NAMES.has(name)) throw err;
                    console.warn(`Dexie operation aborted (${name}); reopening and retrying...`);
                    await reopenDatabase();
                    await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
                }
            }
            throw lastError;
        }

        return {
            ...downlevel,
            table(name) {
                const t = downlevel.table(name);
                return {
                    ...t,
                    mutate:     (req) => wrap(() => t.mutate(req)),
                    get:        (req) => wrap(() => t.get(req)),
                    getMany:    (req) => wrap(() => t.getMany(req)),
                    query:      (req) => wrap(() => t.query(req)),
                    openCursor: (req) => wrap(() => t.openCursor(req)),
                    count:      (req) => wrap(() => t.count(req)),
                };
            }
        };
    }
});

/**
 * Ensure the Dexie connection is open, reopening it if WebKit closed it while
 * the app was backgrounded. Call before bursts of writes on resume (e.g. when
 * the WebSocket reconnects and streams archived CoTs).
 */
export async function ensureDbOpen(): Promise<void> {
    if (!db.isOpen()) await reopenDatabase();
}

