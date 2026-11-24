import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import ws from 'ws';
import Flight from './flight.js';
import { DirectChat, MissionChat } from '@tak-ps/node-cot';
import { rawDataToString } from '../common/stringify.js';
import { sql } from 'drizzle-orm';
import { ProfileChatroomType } from '../common/enums.js';

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
const grouped = randomUUID();

const group = { uid: 'f2a8c4d0-group', callsign: 'Search Team' };

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

                    flight.tak.write(new DirectChat({
                        to: group,
                        from: device,
                        parent: 'UserGroups',
                        message: 'Group Message',
                        messageId: grouped,
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

                    if (res.data.messageId === grouped) {
                        assert.deepEqual(res.data.room, { id: group.uid, name: group.callsign, type: 'group', members: [device] });
                    } else {
                        assert.deepEqual(res.data.room, { id: device.uid, name: device.callsign, type: 'direct', members: [] });
                    }

                    if (chats.length === 3) {
                        assert.deepEqual([...chats].sort(), [first, grouped, last].sort());

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
                assert.equal(res.data.chatroom, device.uid);

                conn.close();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });
});

test('GET: api/profile/chatroom (Direct & Group, Mission Chat is not a Chatroom)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 2);

        const rooms = new Map<string, { name: string; type: string; parent: string | null; unread: number }>(
            res.body.items.map((item: { id: string }) => [item.id, item]),
        );

        assert.equal(rooms.get(device.uid)?.name, device.callsign);
        assert.equal(rooms.get(device.uid)?.type, 'direct');
        assert.equal(rooms.get(device.uid)?.unread, 2);

        assert.equal(rooms.get(group.uid)?.name, group.callsign);
        assert.equal(rooms.get(group.uid)?.type, 'group');
        assert.equal(rooms.get(group.uid)?.parent, 'UserGroups');
        assert.equal(rooms.get(group.uid)?.unread, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/chatroom/:chatroom/chat (Stored once, sender stamped)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/ANDROID-user-device/chat', {
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

test('PATCH: api/profile/chatroom/:chatroom (Unknown Chat)', async () => {
    const res = await flight.fetch('/api/profile/chatroom/ANDROID-user-device', {
        method: 'PATCH',
        auth: {
            bearer: flight.token.admin,
        },
        body: { last_read: grouped },
    }, false);

    assert.equal(res.status, 404);
});

test('PATCH: api/profile/chatroom/:chatroom (Read up to the first Chat)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/ANDROID-user-device', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: { last_read: first },
        }, true);

        assert.equal(res.body.id, device.uid);
        assert.equal(res.body.unread, 1);
        assert.ok(res.body.last_read);

        await delay(100);

        assert.equal(receipts('b-t-f-r', first), 1);
        assert.equal(receipts('b-t-f-r', last), 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/profile/chatroom/:chatroom (Read the rest)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/ANDROID-user-device', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: { last_read: last },
        }, true);

        assert.equal(res.body.unread, 0);

        await delay(100);

        assert.equal(receipts('b-t-f-r', first), 1);
        assert.equal(receipts('b-t-f-r', last), 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/profile/chatroom/:chatroom (Group Chats send no Read Receipts)', async () => {
    try {
        const res = await flight.fetch(`/api/profile/chatroom/${group.uid}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: { last_read: grouped },
        }, true);

        assert.equal(res.body.unread, 0);

        await delay(100);

        assert.equal(receipts('b-t-f-r', grouped), 0);
        assert.equal(receipts('b-t-f-d', grouped), 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Chatroom keyed by callsign is adopted by the UID behind it', async () => {
    const models = flight.config!.models;
    const username = 'admin@example.com';

    await models.ProfileChatroom.ensure(username, { id: 'Legacy', name: 'Legacy', type: ProfileChatroomType.DIRECT });
    await models.ProfileChat.generate({
        username,
        chatroom: 'Legacy',
        sender_callsign: admin.callsign,
        sender_uid: admin.uid,
        message_id: randomUUID(),
        message: 'Outgoing only',
    });

    const room = await models.ProfileChatroom.ensure(username, { id: 'ANDROID-legacy', name: 'Legacy', type: ProfileChatroomType.DIRECT });
    assert.equal(room.id, 'ANDROID-legacy');

    await assert.rejects(models.ProfileChatroom.room(username, 'Legacy'));

    const chats = await models.ProfileChat.list({
        where: sql`username = ${username} AND chatroom = 'ANDROID-legacy'`,
    });
    assert.equal(chats.total, 1);
});

test('DELETE: api/profile/chatroom/:chatroom', async () => {
    try {
        await flight.fetch('/api/profile/chatroom/ANDROID-user-device', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const rooms = await flight.fetch('/api/profile/chatroom', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(rooms.body.items.map((item: { id: string }) => item.id).sort(), ['ANDROID-legacy', group.uid]);

        const chats = await flight.fetch('/api/profile/chatroom/ANDROID-user-device/chat', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(chats.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
