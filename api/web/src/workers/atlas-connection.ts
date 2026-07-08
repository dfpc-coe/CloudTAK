/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { stdurl } from '../std.ts';
import type Atlas from './atlas.ts';
import { version } from '../../package.json'
import Chatroom from '../base/chatroom.ts';
import { db, ChatStatusRank, ChatStatus } from '../database.ts';
import TAKNotification, { NotificationType } from '../base/notification.ts';
import { WorkerMessageType } from '../base/events.ts';
import type { SyncEvent } from './atlas-sync.ts';
import type { Feature, Import, Chat } from '../types.ts';

const RECONNECT_BACKOFF_STEP_MS = 5000;
const RECONNECT_BACKOFF_MAX_MS = 30000;

export default class AtlasConnection {
    atlas: Atlas;

    isDestroyed: boolean;
    isOpen: boolean;
    hasConnected: boolean;

    // Halts reconnection until the user logs in again
    authFailure: boolean;

    ws: WebSocket | undefined;
    reconnectAttempts: number;

    version: string;

    private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.isDestroyed = false;
        this.isOpen = false;
        this.hasConnected = false;
        this.authFailure = false;
        this.ws = undefined;
        this.reconnectAttempts = 0;

        this.version = version;

        this.reconnectTimer = undefined;
    }

    reconnect(connection: string) {
        console.log('Forcing WebSocket reconnection...');
        this.reconnectAttempts = 0;  // Reset counter
        if (this.ws) {
            this.ws.close();
        }
        this.connect(connection);
    }

    // COTs are submitted to pending and picked up by the partial update code every .5s
    connect(connection: string) {
        this.isDestroyed = false;
        this.authFailure = false;
        this.clearReconnectTimer();

        const url = stdurl('/api');
        url.searchParams.set('format', 'geojson');
        url.searchParams.set('connection', connection);
        url.searchParams.set('token', this.atlas.token);

        if (self.location.protocol === 'http:') {
            url.protocol = 'ws:';
        } else {
            url.protocol = 'wss:';
        }

        const ws = new WebSocket(url);
        this.ws = ws;

        // A socket that closes without ever opening was rejected during the
        // HTTP upgrade (401) or never reached the server
        let opened = false;

        ws.addEventListener('open', () => {
            if (ws !== this.ws) return;

            opened = true;
            this.reconnectAttempts = 0;

            this.atlas.postMessage({ type: WorkerMessageType.Connection_Open });
            this.isOpen = true;

            // Sync events broadcast while this client was disconnected are
            // lost (there is no replay), so any reconnect must trigger a full
            // resync or the client silently drifts until the next page load
            if (this.hasConnected && this.atlas.sync.started) {
                this.atlas.sync.fullSync().catch((err: unknown) => {
                    console.error('Failed to resync after reconnect', err);
                });
            }

            this.hasConnected = true;
        });

        ws.addEventListener('error', (err) => {
            console.error(err);
        });

        ws.addEventListener('close', () => {
            // A socket superseded by reconnect() must not touch state or
            // spawn another connection - that's how reconnect loops multiply
            if (ws !== this.ws) return;

            this.atlas.postMessage({ type: WorkerMessageType.Connection_Close });
            this.isOpen = false;

            if (this.isDestroyed || this.authFailure) return;

            void this.scheduleReconnect(connection, opened);
        });

        ws.addEventListener('message', async (msg) => {
            try {
            const body = JSON.parse(msg.data) as {
                type: string;
                connection: number | string;
                data: unknown
            };

            if (body.type === 'Error') {
                const err = body as unknown as {
                    properties: { message: string }
                };

                if (/unauthorized|jwt expired|invalid token|no auth/i.test(err.properties.message)) {
                    this.handleAuthFailure(err.properties.message);
                    return;
                }

                console.warn('Warning: Validation Error: received Error from WebSocket:', JSON.stringify(body));
                throw new Error(err.properties.message);
            } else if (body.type === 'import') {
                const imp = (body as unknown as {
                    properties: Import
                }).properties;

                await TAKNotification.create(
                    NotificationType.Import,
                    `Import ${imp.status}`,
                    `${imp.name} has been updated to status: ${imp.status}`,
                    `/menu/imports/${imp.id}`,
                    true
                );
            } else if (body.type === 'cot') {
                const feat = body.data as Feature;

                await this.atlas.db.add(feat);

                if ([
                    'b-a',
                    'b-a-o-tbl',
                    'b-a-o-pan',
                    'b-a-o-opn'
                ].includes(feat.properties.type)) {
                    const alertUrl = `/cot/${feat.id}`;
                    if (!await TAKNotification.existsByUrl(alertUrl)) {
                        await TAKNotification.create(
                            NotificationType.Alert,
                            `${feat.properties.callsign} Created`,
                            '',
                            alertUrl,
                            true
                        );
                    }
                } else if ([
                    'b-r-f-h-c'
                ].includes(feat.properties.type)) {
                    await TAKNotification.create(
                        NotificationType.Medical,
                        `New CASEVAC`,
                        `A CASEVAC has been requested for ${feat.properties.callsign}.`,
                        `/cot/${feat.id}`,
                        true
                    );
                }
            } else if (body.type === 'task') {
                const task = body.data as Feature;

                if (task.properties.type.startsWith('t-x-m-c')) {
                    if (task.properties.type === 't-x-m-c-l' && task.properties.mission) {
                        await TAKNotification.create(
                            NotificationType.Mission,
                            `${task.properties.mission.name} Log Entry`,
                            'Log Entry Added or Modified',
                            `/menu/missions/${task.properties.mission.guid}/logs`,
                            true
                        );
                    } else if (
                        task.properties.type === 't-x-m-c'
                        && task.properties.mission?.missionChanges?.length === 1
                        && task.properties.mission?.missionChanges?.[0].contentResource?.name
                    ) {
                        if (task.properties.mission.missionChanges[0].type === 'ADD_CONTENT') {
                            await TAKNotification.create(
                                NotificationType.Mission,
                                `${task.properties.mission.name} File Added`,
                                `File ${task.properties.mission.missionChanges[0].contentResource.name}`,
                                `/menu/missions/${task.properties.mission.guid}/content`,
                                true
                            );
                        } else if (task.properties.mission.missionChanges[0].type === 'REMOVE_CONTENT') {
                            await TAKNotification.create(
                                NotificationType.Mission,
                                `${task.properties.mission.name} File Removed`,
                                `File ${task.properties.mission.missionChanges[0].contentResource.name}`,
                                `/menu/missions/${task.properties.mission.guid}/content`,
                                true
                            );
                        }
                    }

                    // Mission Change Tasking
                    await this.atlas.db.subChange(task);
                } else if (task.properties.type === 't-x-d-d') {
                    // CoT Delete Tasking
                    console.error('DELETE', task.properties);
                } else if (task.properties.type === 't-x-m-n' && task.properties.mission) {
                    await TAKNotification.create(
                        NotificationType.Mission,
                        `${task.properties.mission.name} Created`,
                        '',
                        `/menu/missions/${task.properties.mission.guid}`,
                        true
                    );
                } else if (task.properties.type === 't-x-m-i' && task.properties.mission && task.properties.mission.type === 'INVITE') {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Mission_Invite,
                        body: task.properties.mission
                    });
                } else if (task.properties.type === 't-x-g-c') {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Channel_Change
                    });
                } else {
                    console.warn('Unknown Task', JSON.stringify(task));
                }
            } else if (body.type === 'chat') {
                const chat = body.data as Chat;

                let chatroom = chat.chatroom;

                try {
                    const callsign = this.atlas.profile.profile_callsign?.value;
                    const username = this.atlas.profile.username;

                    if (callsign && username && (chatroom === callsign || chatroom === `ANDROID-CloudTAK-${username}`)) {
                        chatroom = chat.from.callsign;
                    }
                } catch (err) {
                    console.error('Error getting profile for chat routing', err);
                }

                await Chatroom.load(chatroom, { reload: false });

                await db.chatroom.where('id').equals(chatroom).modify(room => {
                    room.updated = chat.time;
                    room.unread = (room.unread || 0) + 1;
                });

                await db.chatroom_chats.put({
                    id: chat.messageId,
                    chatroom: chatroom,
                    sender: chat.from.callsign,
                    sender_uid: chat.from.uid,
                    message: chat.message,
                    created: chat.time
                });

                await TAKNotification.create(
                    NotificationType.Chat,
                    'New Chat Message',
                    `${chat.from.callsign} to ${chat.chatroom} says: ${chat.message}`,
                    `/menu/chats`,
                    true
                );
            } else if (body.type === 'chat:receipt') {
                const receipt = body.data as {
                    messageId: string;
                    status: ChatStatus;
                    chatroom?: string;
                    created?: string;
                };

                if (receipt.messageId && ChatStatusRank[receipt.status] !== undefined) {
                    const progress = (chat: { status?: ChatStatus, created?: string }) => {
                        // Messages sort by created - adopt the server-assigned timestamp so
                        // ordering doesn't depend on the local clock that stamped the optimistic copy
                        if (receipt.created) {
                            chat.created = receipt.created;
                        }

                        if (ChatStatusRank[receipt.status] > ChatStatusRank[chat.status ?? ChatStatus.Sending]) {
                            chat.status = receipt.status;
                        }
                    };

                    await db.chatroom_chats
                        .where('id')
                        .equals(receipt.messageId)
                        .modify(progress);

                    await db.subscription_chat
                        .where('id')
                        .equals(receipt.messageId)
                        .modify(progress);
                }
            } else if (body.type === 'status') {
                const status = body.data as { version: string };

                if (this.version !== status.version) {
                    console.log(`Version change detected: ${this.version} -> ${status.version}`);
                    if ('serviceWorker' in self.navigator) {
                        const registration = await self.navigator.serviceWorker.ready;
                        registration.update().catch((err) => {
                            console.debug('Failed to update ServiceWorker (likely unregistered):', err);
                        });

                        this.version = status.version;
                    } else {
                        console.log('No Service Worker available');
                    }
                } else {
                    if ('serviceWorker' in self.navigator) {
                        const regs = await self.navigator.serviceWorker.getRegistrations()

                        if (!regs.some(reg => {
                            try {
                                const scriptURL = reg.active?.scriptURL;
                                if (!scriptURL) {
                                    return false;
                                }
                                const url = new URL(scriptURL);
                                return url.searchParams.get('v') === status.version;
                            } catch (err) {
                                console.error('Error parsing service worker script URL', err);
                                return false;
                            }
                        })) {
                            console.log(`Service Worker out of date, updating to version ${status.version}`);
                            const registration = await self.navigator.serviceWorker.ready;
                            registration.update().catch((err) => {
                                console.debug('Failed to update ServiceWorker (likely unregistered):', err);
                            });
                        }
                    } else {
                        console.log('No Service Worker available');
                    }
                }
            } else if (body.type === 'sync') {
                // Another of the user's connected clients mutated a data type
                // via the API - trigger a targeted sync in AtlasSync
                await this.atlas.sync.event(body.data as SyncEvent);
            } else if (body.type === 'connected') {
                // Server has finished registering the WebSocket client - no client action needed
            } else {
                console.log('UNKNOWN', body.data);
            }
            } catch (err) {
                console.warn('Error handling WebSocket message:', err);
            }
        });
    }

    private async scheduleReconnect(connection: string, opened: boolean): Promise<void> {
        if (!opened && await this.isAuthRejected()) {
            this.handleAuthFailure('WebSocket upgrade rejected: session is no longer valid');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * RECONNECT_BACKOFF_STEP_MS, RECONNECT_BACKOFF_MAX_MS);

        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.isDestroyed || this.authFailure) return;
            this.connect(connection);
        }, delay);
    }

    private async isAuthRejected(): Promise<boolean> {
        try {
            const res = await fetch(stdurl('/api/login'), {
                headers: { Authorization: `Bearer ${this.atlas.token}` }
            });

            return res.status === 401;
        } catch {
            // Network failure - the server is unreachable, not rejecting us
            return false;
        }
    }

    private handleAuthFailure(message: string): void {
        if (this.authFailure) return;
        this.authFailure = true;

        console.error(`WebSocket auth failure: ${message}`);

        this.clearReconnectTimer();

        // The worker cannot clear stored credentials or navigate - the main
        // thread must route the user to login
        this.atlas.postMessage({
            type: WorkerMessageType.Connection_AuthFailure,
            body: { message }
        });
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer !== undefined) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    destroy() {
        this.isDestroyed = true;

        this.clearReconnectTimer();

        if (this.ws) {
            this.ws.close();
        }
    }


    sendCOT(data: object, type = 'cot') {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({ type, data }));
    }

}
