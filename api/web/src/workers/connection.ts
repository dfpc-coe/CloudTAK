/*
* ConnectionStore - Maintain the WebSocket connection with CloudTAK Server
*/

import { std, stdurl } from '../std.ts';
import { expose } from 'comlink';
import type { Feature } from '../types.ts';

//import { useCOTStore } from './cots.ts';

let isDestroyed: boolean = false;
let isOpen: boolean = false;
let ws: WebSocket | undefined = undefined;

const cots: Map<string, COT> = new Map();
const hidden: Set<string> = new Set();

const pending: Map<string, COT> = new Map();
const pendingDelete: Set<string> = new Set();

const subscriptions: Map<string, Subscription> = new Map();
const subscriptionPending: Map<string, string> = new Map(); // UID, Mission Guid


// COTs are submitted to pending and picked up by the partial update code every .5s

function connect(connection: string, token: string) {
    isDestroyed = false;

    const url = stdurl('/api');
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', connection);
    url.searchParams.append('token', token);

    if (self.location.hostname === 'localhost') {
        url.protocol = 'ws:';
    } else {
        url.protocol = 'wss:';
    }

    ws = new WebSocket(url);
    ws.addEventListener('open', () => {
        isOpen = true;
    });
    ws.addEventListener('error', (err) => {
        console.error(err);
    });

    ws.addEventListener('close', () => {
        // Otherwise the user is probably logged out
        if (!isDestroyed) connect(connection, token);

        isOpen = false;
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
                self.postMessage('cloudtak:notification', {
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

/**
 * Generate a GeoJSONDiff on existing COT Features
 */
function diff(): GeoJSONSourceDiff {
    const now = +new Date();
    const diff: GeoJSONSourceDiff = {};
    diff.add = [];
    diff.remove = [];
    diff.update = [];

    // TODO
    //const profileStore = useProfileStore();
    //const display_stale = profileStore.profile ? profileStore.profile.display_stale : 'Immediate';
    const display_stale = 'Immediate';

    for (const cot of cots.values()) {
        const render = cot.as_rendered();
        const stale = new Date(cot.properties.stale).getTime();

        if (hidden.has(String(cot.id))) {
            // TODO check if hidden already
            diff.remove.push(String(cot.id))
        } else if (
            !['Never'].includes(display_stale)
            && !cot.properties.archived
            && (
                display_stale === 'Immediate'       && now > stale
                || display_stale === '10 Minutes'   && now > stale + 600000
                || display_stale === '30 Minutes'   && now > stale + 600000 * 3
                || display_stale === '1 Hour'       && now > stale + 600000 * 6
            )
        ) {
            diff.remove.push(String(cot.id))
        } else if (!cot.properties.archived) {
            if (now < stale && (cot.properties['icon-opacity'] !== 1 || cot.properties['marker-opacity'] !== 1)) {
                cot.properties['icon-opacity'] = 1;
                cot.properties['marker-opacity'] = 1;

                if (!['Point', 'Polygon', 'LineString'].includes(cot.geometry.type)) continue;

                diff.update.push({
                    id: String(render.id),
                    addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                        return { key, value: render.properties ? render.properties[key] : '' }
                    }),
                    newGeometry: render.geometry
                })
            } else if (now > stale && (cot.properties['icon-opacity'] !== 0.5 || cot.properties['marker-opacity'] !== 127)) {
                render.properties['icon-opacity'] = 0.5;
                render.properties['marker-opacity'] = 0.5;

                if (!['Point', 'Polygon', 'LineString'].includes(render.geometry.type)) continue;

                diff.update.push({
                    id: String(render.id),
                    addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                        return { key, value: cot.properties ? render.properties[key] : '' }
                    }),
                    newGeometry: render.geometry
                })
            }
        }
    }

    for (const cot of pending.values()) {
        const render = cot.as_rendered();

        if (cots.has(cot.id)) {
            diff.update.push({
                id: String(render.id),
                addOrUpdateProperties: Object.keys(render.properties).map((key) => {
                    return { key, value: render.properties[key] }
                }),
                newGeometry: render.geometry
            })
        } else {
            diff.add.push(render);
        }

        cots.set(cot.id, cot);
    }

    pending.clear();

    for (const id of pendingDelete) {
        diff.remove.push(id);
        cots.delete(id);
    }

    pendingDelete.clear();

    return diff;
}

/**
 * Load Archived CoTs
 */
async function loadArchive(): Promise<void> {
    const archive = await std('/api/profile/feature') as APIList<Feature>;
    for (const a of archive.items) {
        add(a, undefined, {
            skipSave: true
        });
    }
}

function destroy() {
    isDestroyed = true;

    if (ws) {
        ws.close();
    }
}


function sendCOT(data: object, type = 'cot') {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, data }));
}

expose({
    diff,
    isOpen,
    isDestroyed,
    destroy,
    connect,
    sendCOT,
})
