import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import ws from 'ws';
import Flight from './flight.js';
import { DirectChat, DirectChatReceipt, GroupChat, MissionChat } from '@tak-ps/node-cot';
import { rawDataToString } from '../common/stringify.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

const admin = { uid: 'ANDROID-CloudTAK-admin@example.com', callsign: 'CloudTAK User' };
const user = { uid: 'ANDROID-CloudTAK-user@example.com', callsign: 'CloudTAK User' };
const device = { uid: 'ANDROID-device', callsign: 'Device' };
const bravo = { uid: 'ANDROID-bravo', callsign: 'Bravo' };

type Member = { uid: string; callsign: string; role: string; local: boolean };

type Room = {
    id: string;
    type: string;
    name: string;
    role: string;
    unread: number;
    members: Array<Member>;
};

type Message = {
    id: string;
    body: string;
    sender_uid: string;
    status: string | null;
    reply_to: string | null;
    edited: string | null;
    deleted: string | null;
    reactions: Array<{ emoji: string; uids: Array<string> }>;
};

type Messages = { total: number; items: Array<Message> };

type Event = { type: string; data: { id: string; message: Message; chatroom: Room } };

function sorted(values: Array<string>): Array<string> {
    return [...values].sort((a, b) => a.localeCompare(b));
}

// Everything CloudTAK writes to the TAK Server streaming port
let written = '';

let conn: ws;
const queue: Array<Event> = [];
const waiting: Array<{ match: (event: Event) => boolean; resolve: (event: Event) => void }> = [];

/** The next WebSocket event of a type, skipping anything else that arrived before it */
async function next(type: string, match: (event: Event) => boolean = () => true): Promise<Event> {
    const wanted = (event: Event) => event.type === type && match(event);

    const idx = queue.findIndex(wanted);
    if (idx !== -1) return queue.splice(idx, 1)[0];

    return await new Promise<Event>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 5000);
        waiting.push({
            match: wanted,
            resolve: (event) => {
                clearTimeout(timer);
                resolve(event);
            },
        });
    });
}

function events(type: string): Array<Event> {
    return queue.filter((event) => event.type === type);
}

function sentEvent(messageId: string): string {
    const event = written.split('<event ').find((e) => e.includes(`messageId="${messageId}"`) && e.includes('type="b-t-f"'));
    assert.ok(event, `Message ${messageId} was written to the TAK Server`);
    return event;
}

function receipts(type: 'b-t-f-d' | 'b-t-f-r', messageId: string): number {
    return written.split('<event ')
        .filter((event) => event.includes(`type="${type}"`) && event.includes(`uid="${messageId}"`))
        .length;
}

async function api(as: 'admin' | 'user', method: string, url: string, body?: object): Promise<{ status: number; body: unknown }> {
    const res = await flight.fetch(url, {
        method,
        auth: { bearer: flight.token[as] },
        body,
    }, false);

    return res;
}

async function ok<T = Message>(as: 'admin' | 'user', method: string, url: string, body?: object): Promise<T> {
    const res = await api(as, method, url, body);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body as T;
}

async function rooms(as: 'admin' | 'user'): Promise<Array<Room>> {
    return (await ok<{ items: Array<Room> }>(as, 'GET', '/api/chatroom')).items;
}

async function listMessages(as: 'admin' | 'user', id: string, query = ''): Promise<Messages> {
    return await ok<Messages>(as, 'GET', `/api/chatroom/${id}/message${query}`);
}

const ids = {
    first: randomUUID(),
    reply: randomUUID(),
    native: randomUUID(),
    direct: '',
    peers: '',
    group: '',
};

test('Open the WebSocket of a user', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    conn = new ws(url);

    conn.on('message', (data) => {
        const event = JSON.parse(rawDataToString(data)) as Event;
        if (event.type === 'status' || event.type === 'cot') return;

        const idx = waiting.findIndex((waiter) => waiter.match(event));
        if (idx !== -1) waiting.splice(idx, 1)[0].resolve(event);
        else queue.push(event);
    });

    await next('connected');

    for (const socket of flight.tak.streamingSockets) {
        socket.on('data', (chunk) => {
            written += String(chunk);
        });
    }
});

test('TAK: a Direct GeoChat is stored once and acknowledged', async () => {
    const cot = new DirectChat({ to: admin, from: device, message: 'Hello', messageId: ids.first });

    flight.tak.write(cot);
    // TAK Server store-and-forward redelivers under the original messageId
    flight.tak.write(cot);

    const event = await next('chat');

    assert.equal(event.data.message.body, 'Hello');
    assert.equal(event.data.message.sender_uid, device.uid);
    assert.equal(event.data.chatroom.type, 'direct');
    assert.equal(event.data.chatroom.name, device.callsign);

    ids.direct = event.data.chatroom.id;

    await delay(200);

    assert.equal(events('chat').length, 0, 'a redelivered GeoChat is not announced twice');
    assert.equal(receipts('b-t-f-d', ids.first), 1);

    flight.tak.write(new MissionChat({
        from: { uid: device.uid },
        senderCallsign: device.callsign,
        mission: { name: 'Mission', id: 'localhost-8443-ssl-Mission' },
        message: 'Mission Message',
    }));

    await delay(200);

    const list = await rooms('admin');

    assert.deepEqual(sorted(list.map((room) => room.type)), ['broadcast', 'direct'], 'Mission Chat is not a Chatroom');

    const direct = list.find((room) => room.id === ids.direct);
    assert.ok(direct);
    assert.equal(direct.name, device.callsign);
    assert.equal(direct.unread, 1);
    assert.deepEqual(sorted(direct.members.map((member) => `${member.uid} ${member.local}`)), [
        `${admin.uid} true`,
        `${device.uid} false`,
    ]);
});

test('TAK: a reply is sent as GeoChat from the user and its receipts move the status forward', async () => {
    const sent = await ok('admin', 'POST', `/api/chatroom/${ids.direct}/message`, { id: ids.reply, body: 'On my way' });

    assert.equal(sent.id, ids.reply);
    assert.equal(sent.status, 'sent');
    assert.equal(sent.sender_uid, admin.uid);

    const event = sentEvent(ids.reply);
    assert.ok(event.includes(`uid="GeoChat.${admin.uid}.${device.uid}.${ids.reply}"`));
    assert.ok(event.includes(`<dest uid="${device.uid}"/>`));

    await next('chat', (e) => e.data.message.id === ids.reply);

    // Sending again under the same ID is not a second message
    await ok('admin', 'POST', `/api/chatroom/${ids.direct}/message`, { id: ids.reply, body: 'On my way' });
    assert.equal((await listMessages('admin', ids.direct)).total, 2);

    flight.tak.write(new DirectChatReceipt({ to: admin, from: device, status: 'read', messageId: ids.reply }));

    const update = await next('chat:update', (e) => e.data.message.id === ids.reply);
    assert.equal(update.data.message.status, 'read');

    // A late Delivered Receipt never downgrades Read
    flight.tak.write(new DirectChatReceipt({ to: admin, from: device, status: 'delivered', messageId: ids.reply }));
    await delay(200);

    const messages = await listMessages('admin', ids.direct);
    assert.equal(messages.items.find((message) => message.id === ids.reply)?.status, 'read');
});

test('TAK: reading a Direct Chatroom sends Read Receipts once', async () => {
    const messages = await listMessages('admin', ids.direct);
    const first = messages.items.find((message) => message.body === 'Hello');
    assert.ok(first);

    const room = await ok<Room>('admin', 'PATCH', `/api/chatroom/${ids.direct}`, { last_read: first.id });
    assert.equal(room.unread, 0);

    await ok<Room>('admin', 'PATCH', `/api/chatroom/${ids.direct}`, { last_read: first.id });
    await delay(200);

    assert.equal(receipts('b-t-f-r', ids.first), 1);
});

test('Native: two users of this server never touch the TAK Server', async () => {
    const room = await ok<Room>('admin', 'POST', '/api/chatroom', { type: 'direct', member: user });
    ids.peers = room.id;

    const again = await ok<Room>('user', 'POST', '/api/chatroom', { type: 'direct', member: admin });
    assert.equal(again.id, room.id, 'both users share one Chatroom');

    const sent = await ok('admin', 'POST', `/api/chatroom/${ids.peers}/message`, { id: ids.native, body: 'Native Message' });
    assert.equal(sent.status, 'sent');

    await delay(100);
    assert.ok(!written.includes(ids.native), 'nothing was written to the TAK Server');

    const theirs = (await rooms('user')).find((r) => r.id === ids.peers);
    assert.ok(theirs);
    assert.equal(theirs.unread, 1);

    await ok<Room>('user', 'PATCH', `/api/chatroom/${ids.peers}`, { last_read: ids.native });

    const update = await next('chat:update', (e) => e.data.message.id === ids.native);
    assert.equal(update.data.message.status, 'read');
});

test('Native: replies, edits, reactions & deletes', async () => {
    const reply = await ok('user', 'POST', `/api/chatroom/${ids.peers}/message`, { body: 'A Reply', reply_to: ids.native });
    assert.equal(reply.reply_to, ids.native);

    const event = await next('chat', (e) => e.data.message.id === reply.id);
    assert.equal(event.data.message.status, null, 'delivery status is only shown to the sender');

    const reacted = await ok('admin', 'PUT', `/api/chatroom/${ids.peers}/message/${reply.id}/reaction`, { emoji: '👍' });
    assert.deepEqual(reacted.reactions, [{ emoji: '👍', uids: [admin.uid] }]);

    const cleared = await ok('admin', 'PUT', `/api/chatroom/${ids.peers}/message/${reply.id}/reaction`, { emoji: '👍', active: false });
    assert.deepEqual(cleared.reactions, []);

    assert.equal((await api('admin', 'PATCH', `/api/chatroom/${ids.peers}/message/${reply.id}`, { body: 'Hijacked' })).status, 403);

    const edited = await ok('user', 'PATCH', `/api/chatroom/${ids.peers}/message/${reply.id}`, { body: 'An Edited Reply' });
    assert.equal(edited.body, 'An Edited Reply');
    assert.ok(edited.edited);

    const found = await listMessages('admin', ids.peers, `?filter=edited`);
    assert.deepEqual(found.items.map((message) => message.id), [reply.id]);

    const older = await listMessages('admin', ids.peers, `?before=${reply.id}`);
    assert.deepEqual(older.items.map((message) => message.id), [ids.native]);

    assert.equal((await api('admin', 'DELETE', `/api/chatroom/${ids.peers}/message/${reply.id}`)).status, 403);

    const removed = await ok('user', 'DELETE', `/api/chatroom/${ids.peers}/message/${reply.id}`);
    assert.equal(removed.body, '');
    assert.ok(removed.deleted);

    assert.equal((await api('user', 'GET', `/api/chatroom/${ids.direct}/message`)).status, 404, 'a Chatroom is only visible to its Members');
});

test('Group: owned by a user, bridged to TAK for the Members that are not', async () => {
    const room = await ok<Room>('admin', 'POST', '/api/chatroom', { type: 'group', name: 'Search Team', members: [user, device] });
    ids.group = room.id;

    assert.equal(room.role, 'owner');
    assert.deepEqual(sorted(room.members.map((member) => member.uid)), sorted([admin.uid, user.uid, device.uid]));

    const sent = await ok('admin', 'POST', `/api/chatroom/${ids.group}/message`, { body: 'Rally at the trailhead' });
    assert.equal(sent.status, 'sent');

    const event = sentEvent(sent.id);
    assert.ok(event.includes(`id="${ids.group}"`));
    assert.ok(event.includes('parent="UserGroups"'));
    assert.ok(event.includes('groupOwner="true"'));
    assert.ok(event.includes('<hierarchy>'));
    assert.ok(event.includes(`<contact uid="${user.uid}"`));
    assert.ok(event.includes(`<dest uid="${device.uid}"/>`));

    assert.equal((await rooms('user')).find((r) => r.id === ids.group)?.unread, 1);

    // Sending connects the user to the TAK Server, so they now receive every GeoChat as well
    const theirs = await ok('user', 'POST', `/api/chatroom/${ids.group}/message`, { body: 'Copy', reply_to: sent.id });
    assert.equal(theirs.status, 'sent');

    const answer = randomUUID();

    flight.tak.write(new GroupChat({
        from: device,
        group: { id: ids.group, name: 'Renamed By A Member' },
        members: [admin],
        groupOwner: true,
        message: 'Five minutes out',
        messageId: answer,
    }));

    const received = await next('chat', (e) => e.data.message.body === 'Five minutes out');
    assert.equal(received.data.chatroom.id, ids.group);
    assert.equal(received.data.chatroom.name, 'Search Team', 'only the owner renames a Group');

    const after = await ok<Room>('user', 'GET', `/api/chatroom/${ids.group}`);
    assert.equal(after.members.length, 3, 'only the owner removes Members');

    const history = await listMessages('user', ids.group);
    assert.equal(
        history.items.filter((message) => message.body === 'Five minutes out').length,
        1,
        'a GeoChat received on the connection of every Member is stored once',
    );

    assert.equal((await api('user', 'PUT', `/api/chatroom/${ids.group}/member`, { members: [device] })).status, 403);

    const roster = await ok<Room>('admin', 'PUT', `/api/chatroom/${ids.group}/member`, { members: [device, bravo] });
    assert.deepEqual(sorted(roster.members.map((member) => member.uid)), sorted([admin.uid, device.uid, bravo.uid]));

    assert.equal((await api('user', 'GET', `/api/chatroom/${ids.group}`)).status, 404);

    await delay(100);
    assert.ok(written.includes(`<dest uid="${bravo.uid}"/>`), 'the new membership is announced to TAK clients');

    await ok('admin', 'DELETE', `/api/chatroom/${ids.group}`);
    await delay(100);

    assert.ok(written.includes(`deleteChild="${ids.group}"`));
    assert.ok(!(await rooms('admin')).some((r) => r.id === ids.group));
});

test('Group: created on a TAK client and deleted by its owner', async () => {
    const group = { id: 'f2a8c4d0-group', name: 'ATAK Team' };

    flight.tak.write(new GroupChat({
        from: device,
        group,
        members: [admin, bravo],
        groupOwner: true,
        message: 'Welcome',
    }));

    const event = await next('chat', (e) => e.data.message.body === 'Welcome');
    const id = event.data.chatroom.id;

    const room = await ok<Room>('admin', 'GET', `/api/chatroom/${id}`);
    assert.equal(room.name, group.name);
    assert.equal(room.role, 'member');
    // The mock TAK Server delivers to every connection, so the other user joined as well
    assert.deepEqual(
        sorted(room.members.filter((member) => member.uid !== user.uid).map((member) => `${member.uid} ${member.role}`)),
        sorted([`${admin.uid} member`, `${bravo.uid} member`, `${device.uid} owner`]),
    );

    const sent = await ok('admin', 'POST', `/api/chatroom/${id}/message`, { body: 'Checking in' });
    const cot = sentEvent(sent.id);
    assert.ok(cot.includes(`id="${group.id}"`), 'the GeoChat group id is kept');
    assert.ok(cot.includes('groupOwner="false"'));
    assert.ok(cot.includes(`<dest uid="${device.uid}"/>`));
    assert.ok(cot.includes(`<dest uid="${bravo.uid}"/>`));

    // Someone who does not own the Group cannot delete it
    flight.tak.write(new GroupChat({
        from: bravo,
        group: { id: 'UserGroups', name: 'Groups' },
        members: [admin],
        parent: 'RootContactGroup',
        deleteChild: group.id,
        message: `Deleted group: ${group.name}`,
    }));

    await delay(200);
    await ok<Room>('admin', 'GET', `/api/chatroom/${id}`);

    flight.tak.write(new GroupChat({
        from: device,
        group: { id: 'UserGroups', name: 'Groups' },
        members: [admin],
        parent: 'RootContactGroup',
        deleteChild: group.id,
        message: `Deleted group: ${group.name}`,
    }));

    const deleted = await next('chatroom:delete', (e) => e.data.id === id);
    assert.equal(deleted.data.id, id);

    assert.equal((await api('admin', 'GET', `/api/chatroom/${id}`)).status, 404);
    assert.ok(!(await rooms('admin')).some((r) => r.name === 'Groups'), 'the notice is not a Chatroom of its own');
});

test('Broadcast: All Chat Rooms belongs to each user', async () => {
    const mine = (await rooms('admin')).find((r) => r.type === 'broadcast');
    const theirs = (await rooms('user')).find((r) => r.type === 'broadcast');

    assert.ok(mine && theirs);
    assert.notEqual(mine.id, theirs.id);

    const sent = await ok('admin', 'POST', `/api/chatroom/${mine.id}/message`, { body: 'Hello Everyone' });

    const cot = sentEvent(sent.id);
    assert.ok(cot.includes('parent="RootContactGroup"'));
    assert.ok(cot.includes('to="All Chat Rooms"'));
    assert.ok(!cot.includes('<dest '));

    flight.tak.write(new GroupChat({
        from: device,
        group: { id: 'All Chat Rooms', name: 'All Chat Rooms' },
        message: 'Broadcast Reply',
    }));

    const event = await next('chat', (e) => e.data.message.body === 'Broadcast Reply');
    assert.equal(event.data.chatroom.id, mine.id);

    // Each connection the TAK Server delivered the broadcast to keeps its own copy
    const copies = await listMessages('user', theirs.id);
    const own = await listMessages('admin', mine.id);

    assert.ok(!copies.items.some((message) => message.body === 'Hello Everyone'), 'what a user broadcasts is not shared with other users directly');
    assert.notEqual(
        copies.items.find((message) => message.body === 'Broadcast Reply')?.id,
        own.items.find((message) => message.body === 'Broadcast Reply')?.id,
    );
});

test('Leaving a Direct Chatroom clears it until its next Message', async () => {
    await ok('admin', 'DELETE', `/api/chatroom/${ids.direct}`);

    assert.ok(!(await rooms('admin')).some((r) => r.id === ids.direct));

    flight.tak.write(new DirectChat({ to: admin, from: device, message: 'Still there?' }));

    const event = await next('chat', (e) => e.data.message.body === 'Still there?');
    assert.equal(event.data.chatroom.id, ids.direct);

    const messages = await listMessages('admin', ids.direct);
    assert.deepEqual(messages.items.map((message) => message.body), ['Still there?']);
});

test('Close the WebSocket', () => {
    conn.close();
});
