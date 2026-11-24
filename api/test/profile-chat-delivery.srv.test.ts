import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import ws from 'ws';
import Flight from './flight.js';
import { DirectChat, MissionChat } from '@tak-ps/node-cot';
import { rawDataToString } from '../common/stringify.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const admin = {
    uid: 'ANDROID-CloudTAK-admin@example.com',
    callsign: 'admin@example.com',
};

const device = {
    uid: 'ANDROID-user-device',
    callsign: 'user@example.com',
};

const first = randomUUID();
const last = randomUUID();
const sent = randomUUID();

// Everything CloudTAK writes to the TAK Server streaming port
let written = '';

function receipts(type: 'b-t-f-d' | 'b-t-f-r', messageId: string): number {
    return written.split('<event ')
        .filter((event) => event.includes(`type="${type}"`) && event.includes(`uid="${messageId}"`))
        .length;
}

function incoming(messageId: string, message: string): DirectChat {
    return new DirectChat({ to: admin, from: device, message, messageId });
}

test('Streaming: Redelivered & Mission Chats', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const conn = new ws(url);

    const chats: Array<string> = [];

    await new Promise<void>((resolve, reject) => {
        conn.on('error', (err) => {
            reject(err);
        }).on('message', async (data) => {
            try {
                const res = JSON.parse(rawDataToString(data));

                if (res.type === 'status') return;

                if (res.type === 'connected') {
                    for (const socket of flight.tak.streamingSockets) {
                        socket.on('data', (chunk) => {
                            written += String(chunk);
                        });
                    }

                    flight.tak.write(incoming(first, 'Once'));
                    // TAK Server store-and-forward redelivers under the original messageId
                    flight.tak.write(incoming(first, 'Once'));

                    flight.tak.write(new MissionChat({
                        from: { uid: device.uid },
                        senderCallsign: device.callsign,
                        mission: { name: 'Mission', id: 'localhost-8443-ssl-Mission' },
                        message: 'Mission Message',
                    }));

                    flight.tak.write(incoming(last, 'Last'));
                    return;
                }

                if (res.type === 'Error') {
                    throw new Error(`WebSocket Error: ${JSON.stringify(res)}`);
                }

                if (res.type === 'cot') return;

                if (res.type === 'chat') {
                    chats.push(res.data.messageId);

                    if (res.data.messageId === last) {
                        assert.deepEqual(chats, [first, last]);

                        conn.send(JSON.stringify({
                            type: 'chat',
                            data: {
                                chatroom: device.callsign,
                                from: { uid: 'ANDROID-someone-else', callsign: 'Someone Else' },
                                to: device,
                                message: 'Reply',
                                messageId: sent,
                            },
                        }));
                    }

                    return;
                }

                assert.equal(res.type, 'chat:receipt');
                assert.equal(res.data.messageId, sent);
                assert.equal(res.data.status, 'sent');

                conn.close();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });
});

test('GET: api/profile/chatroom (Mission Chat is not a Chatroom)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].chatroom, device.callsign);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/chatroom/:chatroom/chat (Stored once, sender stamped)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/user%40example.com/chat', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 3);

        const byId = new Map<string, { sender_uid: string; sender_callsign: string; read: boolean; status: string | null }>(
            res.body.items.map((item: { message_id: string }) => [item.message_id, item]),
        );

        assert.equal(byId.get(first)?.read, false);
        assert.equal(byId.get(last)?.read, false);

        assert.equal(byId.get(sent)?.sender_uid, admin.uid);
        assert.notEqual(byId.get(sent)?.sender_callsign, 'Someone Else');
        assert.equal(byId.get(sent)?.status, 'sent');
        assert.equal(byId.get(sent)?.read, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Streaming: Delivered Receipts are sent once per Direct Chat', async () => {
    await delay(100);

    assert.equal(receipts('b-t-f-d', first), 1);
    assert.equal(receipts('b-t-f-d', last), 1);
    assert.equal(receipts('b-t-f-r', first), 0);

    assert.ok(written.includes(`uid0="${admin.uid}"`));
    assert.ok(!written.includes('ANDROID-someone-else'));
});

test('POST: api/profile/chatroom/:chatroom/read', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/user%40example.com/read', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Read 2 Chats',
        });

        await delay(100);

        assert.equal(receipts('b-t-f-r', first), 1);
        assert.equal(receipts('b-t-f-r', last), 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/chatroom/:chatroom/read (Already Read)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/user%40example.com/read', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Read 0 Chats',
        });

        await delay(100);

        assert.equal(receipts('b-t-f-r', first), 1);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
