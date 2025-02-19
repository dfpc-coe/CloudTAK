/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { stdurl } from '../std.ts';
import { WorkerMessage } from '../base/events.ts';
import type { Feature } from '../types.ts';

export default class AtlasConnection {
    atlas: Atlas;

    isDestroyed: boolean;
    isOpen: boolean;
    ws: WebSocket | undefined;

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.isDestroyed = false;
        this.isDestroyed = false;
        this.ws = undefined;
    }

    // COTs are submitted to pending and picked up by the partial update code every .5s
    connect(connection: string) {
        this.isDestroyed = false;

        const url = stdurl('/api');
        url.searchParams.append('format', 'geojson');
        url.searchParams.append('connection', connection);
        url.searchParams.append('token', this.atlas.token);

        if (self.location.hostname === 'localhost') {
            url.protocol = 'ws:';
        } else {
            url.protocol = 'wss:';
        }

        this.ws = new WebSocket(url);
        this.ws.addEventListener('open', () => {
            this.isOpen = true;
        });
        this.ws.addEventListener('error', (err) => {
            console.error(err);
        });

        this.ws.addEventListener('close', () => {
            // Otherwise the user is probably logged out
            if (!this.isDestroyed) connect(connection, this.atlas.token);

            this.isOpen = false;
        });

        this.ws.addEventListener('message', async (msg) => {
            const body = JSON.parse(msg.data) as {
                type: string;
                connection: number | string;
                data: unknown
            };

            if (body.type === 'Error') {
                const err = body as {
                    properties: { message: string }
                };

                throw new Error(err.properties.message);
            } else if (body.type === 'cot') {
                await this.atlas.db.add(body.data as Feature);
            } else if (body.type === 'task') {
                const task = body.data as Feature;

                if (task.properties.type.startsWith('t-x-m-c')) {
                    // Mission Change Tasking
                    const cotStore = useCOTStore();
                    await cotStore.subChange(task);
                } else if (task.properties.type === 't-x-d-d') {
                    // CoT Delete Tasking
                    console.error('DELETE', task.properties);
                } else {
                    console.warn('Unknown Task', JSON.stringify(task));
                }
            } else if (body.type === 'chat') {
                const chat = (body.data as Feature).properties;
                if (chat.chat) {
                    self.postMessage({
                        type: WorkerMessage.Notification,
                        body: {
                            type: 'Chat',
                            name: `${chat.chat.senderCallsign} to ${chat.chat.chatroom} says:`,
                            body: chat.remarks || '',
                            url: `/menu/chats`
                        }
                    });
                } else {
                    console.log('UNKNOWN Chat', body.data);
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
