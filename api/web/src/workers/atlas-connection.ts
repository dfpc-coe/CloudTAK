/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { stdurl } from '../std.ts';
import type Atlas from './atlas.ts';
import { WorkerMessageType } from '../base/events.ts';
import type { Feature } from '../types.ts';

export default class AtlasConnection {
    atlas: Atlas;

    connection?: string;

    isDestroyed: boolean;
    isOpen: boolean;
    ws: WebSocket | undefined;

    timings: number[]; // last 10 latency timings
    latencyThreshold: 1000; // ms to consider a connection to be high latency
    reconectThreshold: 5000; // ms to consider a connection to be considered lost

    constructor(atlas: Atlas) {
        this.atlas = atlas;

        this.timings = [];
        this.isDestroyed = false;
        this.isOpen = false;
        this.ws = undefined;
    }

    // COTs are submitted to pending and picked up by the partial update code every .5s
    connect(connection?: string) {
        this.isDestroyed = false;

        if (connection) this.connection = connection;

        if (!this.connection) {
            throw new Error('No connection specified');
        }

        const url = stdurl('/api');
        url.searchParams.append('format', 'geojson');
        url.searchParams.append('connection', this.connection);
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
            this.reconnect();
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
            } else if (body.type === 'cot') {
                const feat = body.data as Feature;

                await this.atlas.db.add(feat);

                if ([
                    'b-a',
                    'b-a-o-tbl',
                    'b-a-o-pan',
                    'b-a-o-opn'
                ].includes(feat.properties.type)) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Notification,
                        body: {
                            type: 'Alert',
                            name: `${feat.properties.callsign} Created`,
                            body: '',
                            url: `/cot/${feat.id}`
                        }
                    });
                } else if ([
                    'b-r-f-h-c'
                ].includes(feat.properties.type)) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Notification,
                        body: {
                            type: 'Medical',
                            name: `${feat.properties.callsign} CASEVAC`,
                            body: '',
                            url: `/cot/${feat.id}`
                        }
                    });
                }
            } else if (body.type === 'ping') {
                const data = body.data as  { time: string };
                const sentTime = new Date(data.time).getTime();
                const receivedTime = Date.now();
                const latency = receivedTime - sentTime;
                this.timings.push(latency);

                if (this.timings.length > 10) {
                    this.timings.shift();
                }

                if (this.timings.length >= 10 && this.isReconnectLatency()) {
                    console.error('Reconnect Latency Detected');
                    this.close();
                } else if (this.timings.length >= 10 && this.isHighLatency()) {
                    console.error('High Latency Detected');
                    this.atlas.postMessage({ type: WorkerMessageType.Connection_Latent });
                }
            } else if (body.type === 'task') {
                const task = body.data as Feature;

                if (task.properties.type.startsWith('t-x-m-c')) {
                    // Mission Change Tasking
                    await this.atlas.db.subChange(task);
                } else if (task.properties.type === 't-x-d-d') {
                    // CoT Delete Tasking
                    console.error('DELETE', task.properties);
                } else if (task.properties.type === 't-x-m-n' && task.properties.mission) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Notification,
                        body: {
                            type: 'Mission',
                            name: `${task.properties.mission.name} Created`,
                            body: '',
                            url: `/menu/missions/${task.properties.mission.guid}`
                        }
                    });
                } else {
                    console.warn('Unknown Task', JSON.stringify(task));
                }
            } else if (body.type === 'chat') {
                const chat = (body.data as Feature).properties;
                if (chat.chat) {
                    this.atlas.postMessage({
                        type: WorkerMessageType.Notification,
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

    reconnect(): void {
        this.timings = [];

        this.atlas.postMessage({ type: WorkerMessageType.Connection_Close });
        this.isOpen = false;

        // Reconnects are not allowed if the connection is destroyed
        if (this.isDestroyed) return;

        this.connect();
    }

    /**
     * Manually trigger a close which will allow reconnects
     */
    close(): void {
        this.timings = [];

        if (this.ws) {
            this.ws.close();
        }
    }

    /**
     * Destory the WebSocket connection and prevent reconnects
     */
    destroy() {
        this.isDestroyed = true;
        this.connection = undefined;

        this.close();
    }

    /**
     * Deterine if the connection has high latency
     */
    isHighLatency(): boolean {
        const sum = this.timings.reduce((acc, cur) => acc + cur, 0);

        const avg = sum / this.timings.length;
        return avg > this.latencyThreshold;
    }

    /**
     * Deterine if the connection has high latency & exceeds the reconnect threshold
     */
    isReconnectLatency(): boolean {
        const sum = this.timings.reduce((acc, cur) => acc + cur, 0);

        const avg = sum / this.timings.length;
        return avg > this.reconnectThreshold;
    }

    sendCOT(data: object, type = 'cot') {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({ type, data }));
    }

}
