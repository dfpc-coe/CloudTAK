/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { defineStore } from 'pinia'
import { stdurl } from '../std.ts';
import type { Feature } from '../types.ts';
import { useCOTStore } from './cots.ts';
import { useProfileStore } from './profile.ts';
const profileStore = useProfileStore();
const cotStore = useCOTStore();

export const useConnectionStore = defineStore('connection', {
    state: (): {
        open: boolean
        ws?: WebSocket
    } => {
        return {
            open: false,
            ws: undefined
        }
    },
    actions: {
        connectSocket: function(connection: string) {
            const url = stdurl('/api');
            url.searchParams.append('format', 'geojson');
            url.searchParams.append('connection', connection);
            url.searchParams.append('token', localStorage.token);

            if (window.location.hostname === 'localhost') {
                url.protocol = 'ws:';
            } else {
                url.protocol = 'wss:';
            }

            this.ws = new WebSocket(url);
            this.ws.addEventListener('open', () => {
                this.open = true;
            });
            this.ws.addEventListener('error', (err) => {
                console.error(err);
            });

            this.ws.addEventListener('close', () => {
                // Otherwise the user is probably logged out
                if (localStorage.token) this.connectSocket(connection);

                this.open = false;
            });

            this.ws.addEventListener('message', async (msg) => {
                const body = JSON.parse(msg.data) as {
                    type: string;
                    connection: number | string;
                    data: unknown
                };

                if (body.type === 'Error') {
                    const err = body.data as {
                        properties: { message: string }
                    };

                    throw new Error(err.properties.message);
                } else if (body.type === 'cot') {
                    await cotStore.add(body.data as Feature);
                } else if (body.type === 'task') {
                    const task = body.data as Feature;

                    if (task.properties.type === 't-x-m-c') {
                        // Mission Change Tasking
                        cotStore.subChange(task);
                    } else if (task.properties.type === 't-x-d-d') {
                        // CoT Delete Tasking
                        console.error('DELETE', task.properties);
                    } else {
                        console.warn('Unknown Task', JSON.stringify(task));
                    }
                } else if (body.type === 'chat') {
                    profileStore.notifications.push({
                        type: 'Chat',
                        name: 'New Chat',
                        url: `/menu/chats`
                    });
                } else {
                    console.log('UNKNOWN', body.data);
                }
            });
        },
        sendCOT: function(data: any, type = 'cot') {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            this.ws.send(JSON.stringify({ type, data }));
        },
    }
})
