/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { stdurl } from '../std.ts';
import type Atlas from './atlas.ts';
import { version } from '../../package.json'
import Chatroom from '../base/chatroom.ts';
import { db } from '../base/database.ts';
import TAKNotification, { NotificationType } from '../base/notification.ts';
import { WorkerMessageType } from '../base/events.ts';
import type { Feature, Import, Chat } from '../types.ts';

export default class AtlasConnection {
    atlas: Atlas;

    isDestroyed: boolean;
    isOpen: boolean;
    ws: WebSocket | undefined;

    version: string;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.isDestroyed = false;
        this.isOpen = false;
        this.ws = undefined;

        this.version = version;
    }

    // COTs are submitted to pending and picked up by the partial update code every .5s
    connect(connection: string) {
        this.isDestroyed = false;

        const url = stdurl('/api');
        url.searchParams.append('format', 'geojson');
        url.searchParams.append('connection', connection);
        url.searchParams.append('token', this.atlas.token);

        if (self.location.protocol === 'http:') {
            url.protocol = 'ws:';
        } else {
            url.protocol = 'wss:';
        }

        this.ws = new WebSocket(url);

        this.ws.addEventListener('open', () => {
            this.atlas.postMessage({ type: WorkerMessageType.Connection_Open });
            this.isOpen = true;
        });

        this.ws.addEventListener('error', (err) => {
            console.error(err);
        });

        this.ws.addEventListener('close', () => {
            // Otherwise the user is probably logged out
            if (!this.isDestroyed) {
                this.connect(connection);
            }

            this.atlas.postMessage({ type: WorkerMessageType.Connection_Close });
            this.isOpen = false;
        });

        this.ws.addEventListener('message', async (msg) => {
            const body = JSON.parse(msg.data) as {
                type: string;
                connection: number | string;
                data: unknown
            };

            if (body.type === 'Error') {
                const err = body as unknown as {
                    properties: { message: string }
                };

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
                    await TAKNotification.create(
                        NotificationType.Alert,
                        `${feat.properties.callsign} Created`,
                        '',
                        `/cot/${feat.id}`,
                        true
                    );
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
                } else {
                    console.warn('Unknown Task', JSON.stringify(task));
                }
            } else if (body.type === 'chat') {
                const chat = body.data as Chat;

                let chatroom = chat.chatroom;

                try {
                    const profile = await this.atlas.profile.profile;
                    if (profile && (chatroom === profile.tak_callsign || chatroom === `ANDROID-CloudTAK-${profile.username}`)) {
                        chatroom = chat.from.callsign;
                    }
                } catch (err) {
                    console.error('Error getting profile for chat routing', err);
                }

                await Chatroom.load(chatroom, { reload: false });

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
            } else if (body.type === 'status') {
                const status = body.data as { version: string };

                if (this.version !== status.version) {
                    console.log(`Version change detected: ${this.version} -> ${status.version}`);
                    if ('serviceWorker' in self.navigator) {
                        const registration = await self.navigator.serviceWorker.ready;
                        registration.update();

                        this.version = status.version;
                    } else {
                        console.log('No Service Worker available');
                    }
                } else {
                    if ('serviceWorker' in self.navigator) {
                        const regs = await self.navigator.serviceWorker.getRegistrations()

                        if (!regs.some(reg => reg.active?.scriptURL.includes(`version=${status.version}`))) {
                            console.log(`Service Worker out of date, updating to version ${status.version}`);
                            const registration = await self.navigator.serviceWorker.ready;
                            registration.update();
                        }
                    } else {
                        console.log('No Service Worker available');
                    }
                }
            } else {
                console.log('UNKNOWN', body.data);
            }
        });
    }

    destroy() {
        this.isDestroyed = true;

        if (this.ws) {
            this.ws.close();
        }
    }


    sendCOT(data: object, type = 'cot') {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({ type, data }));
    }

}
