/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { stdurl } from '../std.ts';
import { expose } from 'comlink';
import type { Feature } from '../types.ts';

expose({ doCalculation, initialize });

//import { useCOTStore } from './cots.ts';
//import { useProfileStore } from './profile.ts';

const destroyed: boolean = false;
const open: boolean = false;
const ws?: WebSocket;

function destroy() {
    destroyed = true;
    if (ws) ws.close();
}

function connect(connection: string) {
    destroyed = false;

    const url = stdurl('/api');
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', connection);
    url.searchParams.append('token', localStorage.token);

    if (window.location.hostname === 'localhost') {
        url.protocol = 'ws:';
    } else {
        url.protocol = 'wss:';
    }

    ws = new WebSocket(url);
    ws.addEventListener('open', () => {
        open = true;
    });
    ws.addEventListener('error', (err) => {
        console.error(err);
    });

    ws.addEventListener('close', () => {
        // Otherwise the user is probably logged out
        if (localStorage.token && !destroyed) connect(connection);

        open = false;
    });

    ws.addEventListener('message', async (msg) => {
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
            const cotStore = useCOTStore();
            await cotStore.add(body.data as Feature);
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
                const profileStore = useProfileStore();
                profileStore.pushNotification({
                    type: 'Chat',
                    name: `${chat.chat.senderCallsign} to ${chat.chat.chatroom} says:`,
                    body: chat.remarks || '',
                    url: `/menu/chats`
                });
            } else {
                console.log('UNKNOWN Chat', body.data);
            }
        } else {
            console.log('UNKNOWN', body.data);
        }
    });
}

function sendCOT(data: object, type = 'cot') {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, data }));
}

expose({
    destroy,
    connect,
    sendCOT,
})
