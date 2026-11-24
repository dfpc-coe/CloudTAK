import Err from '@openaddresses/batch-error';
import fs from 'node:fs';
import path from 'node:path';
import ImportControl, { ImportSourceEnum } from '../../common/control/import.js';
import type ConfigStateful from '../config.js';
import Modeler from '@openaddresses/batch-generic';
import { Connection } from '../../common/schema.js';
import { setTimeout as delay } from 'node:timers/promises';
import TAK, { TAKAPI } from '@tak-ps/node-tak';
import CoT, { CoTParser, DirectChatReceipt, chatHierarchyGroup, chatHierarchyContacts } from '@tak-ps/node-cot';
import type ConnectionConfig from '../../common/connection-config.js';
import { MachineConnConfig, ProfileConnConfig, AdminConnConfig, isCoreEntitySubmitter } from '../../common/connection-config.js';
import { ProfileChatStatus, ProfileChatroomType, WebSocket_Event } from '../../common/enums.js';
import type { Chatroom, ChatroomInput } from '../../common/models/ProfileChatroom.js';
import type { ChatroomMember } from '../../common/types.js';
import TAKServerControl, { profileCallsign } from '../../common/control/takserver.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as {
    version: string;
};

/**
 * Chat Receipt CoTs reference an existing message via `chat.messageId` and
 * carry no remarks - they update the delivery status of the original message
 */
const ChatReceiptTypes: Record<string, ProfileChatStatus> = {
    'b-t-f-d': ProfileChatStatus.DELIVERED,
    'b-t-f-r': ProfileChatStatus.READ,
    'b-t-f-p': ProfileChatStatus.PENDING,
    'b-t-f-s': ProfileChatStatus.FAILED,
};

export class ConnectionClient {
    config: ConnectionConfig;
    tak: TAK;
    api: TAKAPI;
    retry: number;
    initial: boolean;

    retrying: boolean;

    secure: boolean;

    /**
     * Set of bitpos integers representing the active channels
     * this connection is currently bound to
     */
    channels: Set<number>;

    channelsLoaded: boolean;

    constructor(
        config: ConnectionConfig,
        tak: TAK,
        api: TAKAPI,
    ) {
        this.tak = tak;
        this.api = api;
        this.config = config;
        this.retry = 0;
        this.initial = true;
        this.retrying = false;
        this.secure = false;
        this.channels = new Set();
        this.channelsLoaded = false;

        this.tak.setMaxListeners(64);
    }

    get ready(): boolean {
        return this.secure && !this.tak.destroyed;
    }

    /**
     * Refresh the set of active channel bitpos integers
     * by querying the group list API
     */
    async refreshChannels(): Promise<void> {
        try {
            const list = await this.api.Group.list({ useCache: true });
            const active = new Set<number>();
            for (const group of list.data) {
                if (group.active) {
                    active.add(group.bitpos);
                }
            }
            this.channels = active;
            this.channelsLoaded = true;
            console.log(`ok - ${this.config.id} - ${this.config.name} - refreshed channels: [${[...active].join(', ')}]`);
        } catch (err) {
            this.channelsLoaded = false;
            console.error(`not ok - ${this.config.id} - ${this.config.name} - failed to refresh channels: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async awaitSecure(timeoutMs = 15000): Promise<void> {
        if (this.ready) return;

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Err(502, null, 'Timeout awaiting TAK Server connection'));
            }, timeoutMs);

            const onSecure = () => {
                cleanup();
                resolve();
            };

            const cleanup = () => {
                clearTimeout(timer);
                this.tak.removeListener('secureConnect', onSecure);
            };

            this.tak.once('secureConnect', onSecure);
        });
    }

    destroy(): void {
        if (isCoreEntitySubmitter(this.config)) {
            this.config.stopEntities();
        }

        this.tak.destroy();
    }
}

/** Mission chat lives in the Mission's CoT store, never in a profile's direct chats */
function isMissionChat(feat: Awaited<ReturnType<typeof CoTParser.to_geojson>>): boolean {
    if (!feat.properties.chat) return false;
    if (feat.properties.chat.parent === 'DataSyncMissionsList') return true;

    const dest = feat.properties.dest;
    return (Array.isArray(dest) ? dest : dest ? [dest] : []).some((d) => !!d.mission);
}

const GroupParents = ['UserGroups', 'TeamGroups'];

export const BroadcastChatroom = 'All Chat Rooms';
const LegacyBroadcastChatrooms = ['All Streaming', 'Streaming'];

/** ATAK falls back to the last segment of the Event UID (GeoChat.<sender>.<conversation>.<messageId>) */
export function chatMessageId(feat: Awaited<ReturnType<typeof CoTParser.to_geojson>>): string {
    return feat.properties.chat?.messageId || feat.id.split('.').pop() || feat.id;
}

/** The Chatroom a GeoChat belongs to from the point of view of the user with the given UID */
export function chatroomOf(
    chat: NonNullable<Awaited<ReturnType<typeof CoTParser.to_geojson>>['properties']['chat']>,
    uid: string,
): ChatroomInput {
    const sender = String(chat.chatgrp?._attributes?.uid0);
    const broadcast = LegacyBroadcastChatrooms.includes(chat.id || chat.chatroom);
    const id = broadcast ? BroadcastChatroom : (chat.id || chat.chatroom);
    const name = LegacyBroadcastChatrooms.includes(chat.chatroom) ? BroadcastChatroom : chat.chatroom;

    // ATAK addresses a 1:1 chat to the recipient's UID, TAK Aware to the sender's own UID
    const direct = id === uid || (id === sender && !GroupParents.includes(chat.parent || ''));

    if (sender !== uid && direct) {
        return { id: sender, name: chat.senderCallsign, type: ProfileChatroomType.DIRECT };
    }

    const group = sender !== uid || id === BroadcastChatroom || GroupParents.includes(chat.parent || '');

    return {
        id,
        name,
        type: group ? ProfileChatroomType.GROUP : ProfileChatroomType.DIRECT,
        parent: chat.parent,
    };
}

/** Everyone a Group GeoChat names as a member, other than the user with the given UID */
export function chatMembers(
    chat: NonNullable<Awaited<ReturnType<typeof CoTParser.to_geojson>>['properties']['chat']>,
    uid: string,
): { members: Array<ChatroomMember>; listed: boolean } {
    const sender = String(chat.chatgrp?._attributes?.uid0);
    const members = new Map<string, ChatroomMember>();

    const group = chat.hierarchy ? chatHierarchyGroup(chat.hierarchy, chat.id || chat.chatroom) : undefined;

    const attrs: Record<string, unknown> = chat.chatgrp?._attributes ?? {};

    for (const [key, value] of Object.entries(attrs)) {
        if (/^uid\d+$/.test(key)) members.set(String(value), { uid: String(value), callsign: String(value) });
    }

    const listed = group ? chatHierarchyContacts(group) : [];
    for (const contact of listed) members.set(contact.uid, contact);

    members.set(sender, { uid: sender, callsign: chat.senderCallsign });
    members.delete(uid);
    members.delete(chat.id || chat.chatroom);

    return { members: [...members.values()], listed: listed.length > 0 };
}

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 */
export const CONNECTION_LINGER_MS = 60000;

export default class ConnectionPool extends Map<number | string, ConnectionClient> {
    config: ConfigStateful;
    importControl: ImportControl;
    closed: boolean;
    pending: Map<number | string, Promise<ConnectionClient>>;

    // Connections scheduled for teardown by deleteLater()
    lingering: Map<number | string, ReturnType<typeof setTimeout>>;

    /**
     * In Low Bandwith environments the WebSocket can persist
     * even when the connection is not adequately transferring data
     *
     * A status message is sent every 5 seconds to ensure the client can
     * detect this and notify the user and/or attempt a reconnect
     */
    pingInterval: ReturnType<typeof setInterval>;

    constructor(config: ConfigStateful) {
        super();

        this.closed = false;
        this.pending = new Map();
        this.lingering = new Map();
        this.config = config;
        this.importControl = new ImportControl(config);

        this.pingInterval = setInterval(() => {
            try {
                for (const clients of this.config.wsClients.values()) {
                    for (const client of clients) {
                        client.ws.send(JSON.stringify({
                            type: 'status',
                            data: {
                                version: pkg.version,
                                time: new Date().toISOString(),
                            },
                        }));
                    }
                }
            } catch (err) {
                console.error('Failed to send ping: ', err);
            }
        }, 5000);

        this.pingInterval.unref();
    }

    async close(): Promise<void> {
        this.closed = true;

        clearInterval(this.pingInterval);

        for (const timer of this.lingering.values()) clearTimeout(timer);
        this.lingering.clear();

        for (const conn of this.values()) {
            conn.destroy();
        }

        this.clear();
    }

    async activeChannels(connection: number | string, fallbackApi?: TAKAPI): Promise<Set<number>> {
        const conn = this.get(connection);
        if (conn?.channels.size) {
            return new Set(conn.channels);
        }

        const api = conn?.api || fallbackApi;
        if (!api) {
            return new Set();
        }

        const channels = new Set(
            (await api.Group.list({ useCache: true })).data
                .filter(group => group.active)
                .map(group => group.bitpos),
        );

        if (conn) {
            conn.channels = channels;
        }

        return channels;
    }

    async loadGeofences(connConfig: ConnectionConfig): Promise<void> {
        try {
            if (this.config.nogeofence || !await this.config.geofence.enabled()) {
                return;
            }

            const geofences = await connConfig.geofences();
            await this.config.geofence.load(connConfig, geofences);
        } catch (err) {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} - failed to load geofences: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async refresh() {
        for (const conn of this.keys()) {
            this.delete(conn);
        }

        await this.init();
    }

    /**
     * Page through connections and start a connection for each one
     */
    async init(): Promise<void> {
        const conns: Promise<unknown>[] = [];

        // Create admin connection (connection 0) using server auth profile
        if (this.config.server.connection && this.config.server.auth.cert && this.config.server.auth.key) {
            conns.push(
                this.add(new AdminConnConfig(this.config)).catch((err) => {
                    console.error(`not ok - admin - failed to connect: ${err instanceof Error ? err.message : String(err)}`);
                }),
            );
        }

        if (!this.config.noconnections) {
            const ConnectionModel = new Modeler(this.config.pg, Connection);
            for await (const conn of ConnectionModel.iter()) {
                if (conn.enabled) {
                    conns.push(this.add(new MachineConnConfig(this.config, conn)));
                }
            }
        }

        await Promise.all(conns);
    }

    status(id: number | string): 'live' | 'dead' | 'unknown' {
        const conn = this.get(id);

        if (conn) {
            return conn.tak.open && !conn.tak.destroyed ? 'live' : 'dead';
        } else {
            return 'unknown';
        }
    }

    /**
     * Handle writing a CoT into the ETL Events/WebSocket Clients
     * This is also called externally by the layer/:layer/cot API as CoTs
     * aren't rebroadcast to the submitter by the TAK Server
     */
    async cots(
        conn: ConnectionConfig,
        cots: CoT[],
    ) {
        try {
            if (conn instanceof ProfileConnConfig) {
                for (const cot of cots) {
                    // While I am reluncant to override user-intent, client's don't necessarily
                    // pass archived tags on the following types which lead to a poor experience
                    // on reloads if not present
                    // b-m-r Route COTs
                    if (['b-m-r'].includes(cot.type())) {
                        cot.archived(true);
                    }

                    const feat = await CoTParser.to_geojson(cot, {
                        normalize2525: true,
                    });

                    const receiptStatus: ProfileChatStatus | undefined = feat.properties && feat.properties.chat
                        ? ChatReceiptTypes[feat.properties.type]
                        : undefined;

                    const missionChat = isMissionChat(feat);

                    // Server-assigned created for the stored chat - relayed in place of the sender
                    // device's CoT time so live ordering matches what clients get on refresh
                    let storedCreated: string | undefined;
                    let duplicate = false;
                    let room: Chatroom | undefined;
                    let notice = false;
                    let removed: string | undefined;

                    try {
                        if (conn instanceof ProfileConnConfig && feat.properties && feat.properties.chat && receiptStatus) {
                            // Chat Receipts don't contain the original message so they
                            // must never be stored as a message themselves
                            if (feat.properties.chat.messageId) {
                                await this.config.models.ProfileChat.receipt(
                                    String(conn.id),
                                    feat.properties.chat.messageId,
                                    receiptStatus,
                                );
                            }
                        } else if (conn instanceof ProfileConnConfig && feat.properties && feat.properties.chat && !missionChat) {
                            const chat = feat.properties.chat;
                            const myUid = conn.uid();
                            const senderUid = chat.chatgrp?._attributes?.uid0;
                            const messageId = chatMessageId(feat);

                            if (chat.deleteChild) {
                                notice = true;

                                if (senderUid !== myUid && await this.config.models.ProfileChatroom.removeChild(
                                    String(conn.id),
                                    chat.id || chat.chatroom,
                                    chat.deleteChild,
                                )) {
                                    removed = chat.deleteChild;
                                }
                            } else {
                                room = await this.config.models.ProfileChatroom.ensure(String(conn.id), chatroomOf(chat, myUid));

                                if (room.type === ProfileChatroomType.GROUP && room.id !== BroadcastChatroom && senderUid !== myUid) {
                                    const { members, listed } = chatMembers(chat, myUid);

                                    room = await this.config.models.ProfileChatroom.membership(String(conn.id), room.id, {
                                        members,
                                        hierarchy: chat.hierarchy,
                                        owner: listed && chat.groupOwner === 'true',
                                    });
                                }

                                // Receipts are only exchanged for 1:1 chats, matching ATAK
                                const isDirect = senderUid !== myUid && room.type === ProfileChatroomType.DIRECT;

                                const stored = await this.config.models.ProfileChat.ingest({
                                    username: String(conn.id),
                                    chatroom: room.id,
                                    sender_callsign: chat.senderCallsign,
                                    sender_uid: chat.chatgrp._attributes.uid0,
                                    message_id: messageId,
                                    message: feat.properties.remarks || '',
                                    read: senderUid === myUid,
                                });

                                duplicate = !stored.created;

                                // Normalize the pg timestamptz to ISO 8601 before it goes over the wire
                                storedCreated = new Date(stored.chat.created).toISOString();

                                if (stored.created && isDirect && senderUid) {
                                    void this.get(conn.id)?.tak.write([new DirectChatReceipt({
                                        to: { uid: senderUid, callsign: chat.senderCallsign },
                                        from: { uid: myUid, callsign: await profileCallsign(this.config, String(conn.id)) },
                                        status: 'delivered',
                                        messageId,
                                    })], { stripFlow: true });
                                }
                            }
                        } else if (conn instanceof ProfileConnConfig && feat.properties.fileshare) {
                            const file = new URL(feat.properties.fileshare.senderUrl);

                            let name = feat.properties.fileshare.name;
                            const { ext } = path.parse(name);
                            if (!ext) name = name + '.zip';

                            await this.importControl.create({
                                username: String(conn.id),
                                name,
                                source: ImportSourceEnum.PACKAGE,
                                source_id: file.searchParams.get('hash') || undefined,
                            });
                        }
                    } catch (err) {
                        console.error('Failed to save COT: ', err);
                    }

                    if (removed) {
                        for (const client of (this.config.wsClients.get(String(conn.id)) || [])) {
                            if (!client.events.includes(WebSocket_Event.MAP) || client.format !== 'geojson') continue;

                            client.ws.send(JSON.stringify({
                                type: 'chatroom:delete',
                                connection: conn.id,
                                data: { id: removed },
                            }));
                        }
                    }

                    if (duplicate || notice) continue;

                    for (const client of (this.config.wsClients.get(String(conn.id)) || [])) {
                        if (!client.events.includes(WebSocket_Event.MAP)) continue;

                        if (client.format == 'geojson') {
                            if (feat.properties && feat.properties.chat && receiptStatus) {
                                client.ws.send(JSON.stringify({
                                    type: 'chat:receipt',
                                    connection: conn.id,
                                    data: {
                                        messageId: feat.properties.chat.messageId,
                                        status: receiptStatus,
                                        chatroom: feat.properties.chat.chatroom,
                                    },
                                }));
                            } else if (feat.properties && feat.properties.chat && !missionChat) {
                                client.ws.send(JSON.stringify({
                                    type: 'chat',
                                    connection: conn.id,
                                    data: {
                                        chatroom: feat.properties.chat.chatroom,
                                        room: room ? { id: room.id, name: room.name, type: room.type, members: room.members } : undefined,
                                        messageId: chatMessageId(feat),
                                        from: {
                                            uid: feat.properties.chat.chatgrp?._attributes?.uid0,
                                            callsign: feat.properties.chat.senderCallsign,
                                        },
                                        message: feat.properties.remarks,
                                        time: storedCreated || feat.properties.time || new Date().toISOString(),
                                    },
                                }));
                            } else if (feat.properties.type.startsWith('t-x')) {
                                client.ws.send(JSON.stringify({ type: 'task', connection: conn.id, data: feat }));
                            } else if (feat.properties.type.startsWith('b-f-t')) {
                                // File Transfer request/ack - handled via Imports, never a map feature
                                continue;
                            } else {
                                client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: feat }));
                            }
                        } else {
                            client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: cot.raw }));
                        }
                    }
                }
            }

            if (conn instanceof MachineConnConfig) {
                await this.config.etlEvents.features(conn, cots);
            }
        } catch (err) {
            console.error('Error', err);
        }
    }

    async add(connConfig: ConnectionConfig): Promise<ConnectionClient> {
        if (!connConfig.auth || !connConfig.auth.cert || !connConfig.auth.key) throw new Err(400, null, 'Connection must have auth.cert & auth.key');

        const tracked = this.get(connConfig.id);
        if (tracked) {
            if (this.sameAuth(tracked.config, connConfig)) return tracked;

            // A regenerated certificate must replace the socket - node-tak reconnects
            // with the credentials it was constructed with
            console.log(`ok - ${connConfig.id} - ${connConfig.name} - credentials changed, replacing connection`);
            this.delete(connConfig.id);
        }

        // Ensure 2 concurrent adds for the same connection don't occur
        const existing = this.pending.get(connConfig.id);
        if (existing) return existing;

        const promise = this.#add(connConfig);
        this.pending.set(connConfig.id, promise);

        try {
            return await promise;
        } finally {
            this.pending.delete(connConfig.id);
        }
    }

    async #add(connConfig: ConnectionConfig): Promise<ConnectionClient> {
        let tak: TAK;

        if (this.config.StackName === 'test') {
            tak = await TAK.connect(new URL(this.config.server.url), {
                key: connConfig.auth.key,
                cert: connConfig.auth.cert,
                rejectUnauthorized: false,
                ca: this.config.server.auth.cert,
            }, {
                id: connConfig.id,
                cot: {
                    milsym: {
                        augment: true,
                    },
                },
            });
        } else {
            tak = await TAK.connect(new URL(this.config.server.url), {
                key: connConfig.auth.key,
                cert: connConfig.auth.cert,
            }, {
                id: connConfig.id,
                cot: {
                    milsym: {
                        augment: true,
                    },
                },
            });
        }

        const api = await new TAKServerControl(this.config).asConnection(connConfig);
        const connClient = new ConnectionClient(connConfig, tak, api);
        this.set(connConfig.id, connClient);

        if (!this.config.noconnections && isCoreEntitySubmitter(connConfig)) {
            connConfig.startEntities(tak, api);
        }

        tak.on('cot', async (cot: CoT) => {
            connClient.retry = 0;
            connClient.initial = false;

            if (cot.type() === 't-x-g-c') {
                await connClient.refreshChannels();
            }

            void this.cots(connConfig, [cot]);
        }).on('secureConnect', async () => {
            connClient.secure = true;

            await connClient.refreshChannels();
            await this.loadGeofences(connConfig);

            // Async event listeners must not leak rejections - the pool may
            // be closed while the subscription query is in flight
            try {
                for (const sub of await connConfig.subscriptions()) {
                    let retry = true;
                    do {
                        try {
                            await api.Mission.subscribe(sub.guid || sub.name, {
                                uid: connConfig.uid(),
                            }, {
                                token: sub.token || undefined,
                            });

                            console.log(`Connection: ${connConfig.id} - Sync: ${sub.name}: Subscribed!`);
                            retry = false;
                        } catch (err) {
                            console.warn(`Connection: ${connConfig.id} (${connConfig.uid()}) - Sync: ${sub.name}: ${err instanceof Error ? err.message : String(err)}`);

                            if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
                                await delay(1000);
                            } else {
                                // We don't retry for unknown issues as it could be the Sync has been remotely deleted and will
                                // retry forwever
                                retry = false;
                            }
                        }
                    } while (retry);
                }
            } catch (err) {
                console.error(`not ok - ${connConfig.id} - ${connConfig.name} - failed to load mission subscriptions: ${err instanceof Error ? err.message : String(err)}`);
            }
        }).on('close', async () => {
            connClient.secure = false;
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ close`);
            if (this.isTracked(connClient)) {
                void this.retry(connClient);
            }
        }).on('end', async () => {
            connClient.secure = false;
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ end`);
            if (this.isTracked(connClient)) {
                void this.retry(connClient);
            }
        }).on('timeout', async () => {
            connClient.secure = false;
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ timeout`);
            if (this.isTracked(connClient)) {
                void this.retry(connClient);
            }
        }).on('error', async (err) => {
            connClient.secure = false;
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ error:${err}`);
            if (this.isTracked(connClient)) {
                void this.retry(connClient);
            }
        });

        return connClient;
    }

    /**
     * Determine whether a connection is still managed by the pool.
     */
    private isTracked(connClient: ConnectionClient): boolean {
        return this.get(connClient.config.id) === connClient;
    }

    private sameAuth(a: ConnectionConfig, b: ConnectionConfig): boolean {
        return a.auth.cert === b.auth.cert && a.auth.key === b.auth.key;
    }

    async retry(connClient: ConnectionClient): Promise<void> {
        if (connClient.retrying) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Already Retrying`);
            return;
        } else if (this.closed) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Pool Closed`);
            return;
        }

        connClient.retrying = true;

        const isFirstRetry = connClient.retry === 0;
        const nextRetry = Math.min(connClient.retry + 1, 15);
        const retryms = isFirstRetry ? 0 : Math.min(nextRetry * 1000, 15000);
        connClient.retry = nextRetry;

        console.log(`not ok - ${connClient.config.uid()} - ${connClient.config.name} - retrying in ${retryms}ms`);
        if (retryms > 0) await delay(retryms);

        if (this.closed) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Pool Closed`);
            connClient.retrying = false;
            return;
        }

        if (!this.isTracked(connClient)) {
            console.log('ok - Connection no longer tracked - not retrying');
            connClient.retrying = false;
            return;
        }

        try {
            await connClient.tak.reconnect();
        } catch (err) {
            console.error(`not ok - ${connClient.config.id} - ${connClient.config.name} - reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
            connClient.retrying = false;

            if (!this.closed && this.isTracked(connClient)) {
                await this.retry(connClient);
            }

            return;
        }

        connClient.retrying = false;
    }

    /**
     * Keep a connection alive briefly after its last WebSocket closes - a
     * mobile client returning from the background reconnects within seconds
     * and would otherwise pay for a full TLS handshake every time
     */
    deleteLater(id: number | string, delayMs = CONNECTION_LINGER_MS): void {
        this.keep(id);

        const timer = setTimeout(() => {
            this.lingering.delete(id);
            // The hub seeds an empty client list before auth, so presence alone is not enough
            if ((this.config.wsClients.get(String(id)) || []).length) return;
            this.delete(id);
        }, delayMs);
        timer.unref();

        this.lingering.set(id, timer);
    }

    /**
     * Cancel a pending deleteLater()
     */
    keep(id: number | string): boolean {
        const timer = this.lingering.get(id);
        if (!timer) return false;

        clearTimeout(timer);
        this.lingering.delete(id);
        return true;
    }

    delete(id: number | string): boolean {
        this.keep(id);

        const conn = this.get(id);

        if (conn) {
            conn.destroy();
            super.delete(id);

            if (typeof id === 'number') this.config.etlEvents.featureRefresh(id);

            return true;
        } else {
            return false;
        }
    }
}
