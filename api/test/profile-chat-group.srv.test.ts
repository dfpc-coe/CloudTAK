import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import ws from 'ws';
import Flight from './flight.js';
import { GroupChat } from '@tak-ps/node-cot';
import { rawDataToString } from '../common/stringify.js';
import { ProfileChatroomType } from '../common/enums.js';
import { groupChat } from '../stateful/lib/connection-web.js';
import { mergeMembers } from '../common/models/ProfileChatroom.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const admin = { uid: 'ANDROID-CloudTAK-admin@example.com', callsign: 'admin@example.com' };
const owner = { uid: 'ANDROID-owner', callsign: 'Owner' };
const bravo = { uid: 'ANDROID-bravo', callsign: 'Bravo' };
const charlie = { uid: 'ANDROID-charlie', callsign: 'Charlie' };

const group = { id: 'f2a8c4d0-group', name: 'Search Team' };

type Event = { type: string; data: Record<string, unknown> };

let written = '';

function sentEvent(messageId: string): string {
    const event = written.split('<event ').find((e) => e.includes(`messageId="${messageId}"`));
    assert.ok(event, `Chat ${messageId} was written to the TAK Server`);
    return event;
}

function byUid(a: { uid: string }, b: { uid: string }): number {
    return a.uid.localeCompare(b.uid);
}

async function members(id: string): Promise<Array<{ uid: string; callsign: string }>> {
    const room = await flight.config!.models.ProfileChatroom.room('admin@example.com', id);
    return [...room.members].sort(byUid);
}

test('mergeMembers: only the owner removes members', () => {
    assert.deepEqual(mergeMembers([owner, bravo], [charlie], false), [owner, bravo, charlie]);
    assert.deepEqual(mergeMembers([owner, bravo], [owner, charlie], true), [owner, charlie]);
    assert.deepEqual(
        mergeMembers([bravo], [{ uid: bravo.uid, callsign: bravo.uid }], false),
        [bravo],
        'a member known only by UID keeps its callsign',
    );
});

test('Streaming: Group Chat membership, send & delete', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const conn = new ws(url);

    const queue: Array<Event> = [];
    const waiting: Array<(event: Event) => void> = [];

    conn.on('message', (data) => {
        const event = JSON.parse(rawDataToString(data)) as Event;
        if (event.type === 'status' || event.type === 'cot') return;

        const waiter = waiting.shift();
        if (waiter) waiter(event);
        else queue.push(event);
    });

    const next = async (type: string): Promise<Event> => {
        const event = queue.shift() ?? await new Promise<Event>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 5000);
            waiting.push((e) => {
                clearTimeout(timer);
                resolve(e);
            });
        });

        assert.equal(event.type, type, JSON.stringify(event));
        return event;
    };

    try {
        await next('connected');

        for (const socket of flight.tak.streamingSockets) {
            socket.on('data', (chunk) => {
                written += String(chunk);
            });
        }

        flight.tak.write(new GroupChat({
            from: owner,
            group,
            members: [admin, bravo],
            groupOwner: true,
            message: 'Welcome',
        }));

        const welcome = await next('chat');
        const room = welcome.data.room as { id: string; type: string; members: Array<{ uid: string }> };
        assert.equal(room.id, group.id);
        assert.equal(room.type, 'group');
        assert.deepEqual([...room.members].sort(byUid), [bravo, owner].sort(byUid));

        flight.tak.write(new GroupChat({
            from: bravo,
            group,
            members: [admin, charlie],
            message: 'Charlie is here too',
        }));

        await next('chat');
        assert.deepEqual(await members(group.id), [bravo, charlie, owner].sort(byUid), 'a member can only add');

        flight.tak.write(new GroupChat({
            from: owner,
            group,
            members: [admin, charlie],
            groupOwner: true,
            message: 'Bravo has left',
        }));

        await next('chat');
        assert.deepEqual(await members(group.id), [charlie, owner].sort(byUid), 'the owner replaces the membership');

        const reply = randomUUID();
        conn.send(JSON.stringify({
            type: 'chat',
            data: { chatroom: group.name, group: group.id, message: 'On my way', messageId: reply },
        }));

        const receipt = await next('chat:receipt');
        assert.equal(receipt.data.messageId, reply);
        assert.equal(receipt.data.status, 'sent');
        assert.equal(receipt.data.chatroom, group.id);

        const event = sentEvent(reply);
        assert.ok(event.includes(`uid="GeoChat.${admin.uid}.${group.id}.${reply}"`));
        assert.ok(event.includes(`id="${group.id}"`));
        assert.ok(event.includes('parent="UserGroups"'));
        assert.ok(event.includes('groupOwner="false"'));
        assert.ok(event.includes(`<dest uid="${owner.uid}"/>`));
        assert.ok(event.includes(`<dest uid="${charlie.uid}"/>`));
        assert.ok(!event.includes(`<dest uid="${bravo.uid}"/>`));
        assert.ok(event.includes('<hierarchy>'));

        const stored = await flight.fetch(`/api/profile/chatroom/${group.id}/chat`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        const mine = stored.body.items.find((item: { message_id: string }) => item.message_id === reply);
        assert.equal(mine.sender_uid, admin.uid);
        assert.equal(mine.status, 'sent');

        const shout = randomUUID();
        conn.send(JSON.stringify({
            type: 'chat',
            data: { chatroom: 'All Chat Rooms', group: 'All Chat Rooms', message: 'Hello Everyone', messageId: shout },
        }));

        const shouted = await next('chat:receipt');
        assert.equal(shouted.data.chatroom, 'All Chat Rooms');

        const broadcast = sentEvent(shout);
        assert.ok(broadcast.includes('parent="RootContactGroup"'));
        assert.ok(broadcast.includes('to="All Chat Rooms"'));
        assert.ok(!broadcast.includes('<dest '));

        conn.send(JSON.stringify({
            type: 'chat',
            data: { chatroom: owner.callsign, group: 'ANDROID-unknown', message: 'Nobody', messageId: randomUUID() },
        }));

        await next('Error');

        flight.tak.write(new GroupChat({
            from: owner,
            group: { id: 'UserGroups', name: 'Groups' },
            members: [admin],
            parent: 'RootContactGroup',
            deleteChild: group.id,
            message: `Deleted group: ${group.name}`,
        }));

        const deleted = await next('chatroom:delete');
        assert.equal(deleted.data.id, group.id);

        const rooms = await flight.fetch('/api/profile/chatroom', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(rooms.body.items.map((item: { id: string }) => item.id), ['All Chat Rooms']);
        assert.deepEqual(rooms.body.items[0].members, []);
    } finally {
        conn.close();
    }
});

test('Group delete notices cannot remove a Direct Chatroom', async () => {
    const rooms = flight.config!.models.ProfileChatroom;
    const username = 'admin@example.com';

    await rooms.ensure(username, { id: bravo.uid, name: bravo.callsign, type: ProfileChatroomType.DIRECT });
    await rooms.ensure(username, { id: 'nested', name: 'Nested', type: ProfileChatroomType.GROUP, parent: group.id });

    assert.equal(await rooms.removeChild(username, 'UserGroups', bravo.uid), false);
    assert.equal(await rooms.removeChild(username, 'UserGroups', 'nested'), false);
    assert.equal(await rooms.removeChild(username, group.id, 'nested'), true);

    await rooms.room(username, bravo.uid);
});

test('groupChat: nested Groups carry the stored hierarchy and never broadcast', async () => {
    const rooms = flight.config!.models.ProfileChatroom;
    const username = 'admin@example.com';

    const empty = await rooms.ensure(username, { id: 'nested', name: 'Nested', type: ProfileChatroomType.GROUP, parent: group.id });

    assert.throws(() => groupChat(empty, admin, 'Nobody'), /no known members/);

    const nested = await rooms.membership(username, 'nested', {
        owner: true,
        members: [owner, bravo],
        hierarchy: {
            uid: 'UserGroups',
            name: 'Groups',
            type: 'group',
            children: [{
                uid: group.id,
                name: group.name,
                type: 'group',
                children: [{
                    uid: 'nested',
                    name: 'Nested',
                    type: 'group',
                    children: [
                        { uid: owner.uid, name: owner.callsign, type: 'contact' },
                        { uid: bravo.uid, name: bravo.callsign, type: 'contact' },
                        { uid: admin.uid, name: admin.callsign, type: 'contact' },
                    ],
                }],
            }],
        },
    });

    const cot = groupChat(nested, admin, 'Nested Message');
    const chat = cot.raw.event.detail?.__chat;

    assert.equal(chat?._attributes.parent, group.id);
    assert.equal(chat?._attributes.groupOwner, 'false');
    assert.equal(chat?.hierarchy.group._attributes.uid, 'UserGroups');
    assert.equal(chat?.hierarchy.group.group[0].group[0]._attributes.uid, 'nested');
    assert.deepEqual(chat?.chatgrp._attributes, {
        uid0: admin.uid,
        id: 'nested',
        uid1: owner.uid,
        uid2: bravo.uid,
    });
});
