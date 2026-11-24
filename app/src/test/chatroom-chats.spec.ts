import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
}));

vi.mock('../std.ts', () => ({ server }));

import { db, ChatStatus } from '../database.ts';
import ChatroomChats, { SEND_TIMEOUT_MS, BroadcastChatroom } from '../base/chatroom-chats.ts';
import type Atlas from '../workers/atlas.ts';
import type { Remote } from 'comlink';

const NAME = 'ALPHA';
const ROOM = 'ANDROID-alpha';
const me = { uid: 'ANDROID-CloudTAK-me@example.com', callsign: 'ME' };
const peer = { uid: ROOM, callsign: NAME };

const sendCOT = vi.fn();
const worker = { conn: { sendCOT }, profile: { location: undefined } } as unknown as Remote<Atlas>;

function remote(items: Array<{ message_id: string; read: boolean; status?: string | null }>): void {
    server.GET.mockResolvedValue({
        data: {
            total: items.length,
            items: items.map((item) => ({
                sender_callsign: NAME,
                sender_uid: peer.uid,
                message: 'server',
                created: '2026-01-01T00:00:00.000Z',
                status: null,
                ...item,
            })),
        },
    });
}

describe('ChatroomChats', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await db.chatroom.clear();
        await db.chatroom_chats.clear();
        await db.chatroom.put({ id: ROOM, name: NAME, type: 'direct', created: '', updated: '', last_read: null });
        server.PATCH.mockResolvedValue({ data: { last_read: '2026-01-01T00:00:00.000Z' } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fails a message when the WebSocket is closed and resends it under the same id', async () => {
        const chats = new ChatroomChats(ROOM);

        sendCOT.mockResolvedValue(false);
        await chats.send('hello', me, worker, peer);

        const [failed] = await chats.list();
        expect(failed.status).toBe(ChatStatus.Failed);

        sendCOT.mockResolvedValue(true);
        await chats.retry(failed.id, me, worker, peer);

        const [retried] = await chats.list();
        expect(retried.id).toBe(failed.id);
        expect(retried.status).toBe(ChatStatus.Sending);
        expect(sendCOT.mock.calls[1][0].messageId).toBe(failed.id);
    });

    it('fails a message the server never acknowledges', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });

        const chats = new ChatroomChats(ROOM);

        sendCOT.mockResolvedValue(true);
        await chats.send('hello', me, worker, peer);
        expect((await chats.list())[0].status).toBe(ChatStatus.Sending);

        await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS + 1);

        expect((await db.chatroom_chats.toArray())[0].status).toBe(ChatStatus.Failed);
    });

    it('leaves an acknowledged message alone when the timeout fires', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });

        const chats = new ChatroomChats(ROOM);

        sendCOT.mockResolvedValue(true);
        await chats.send('hello', me, worker, peer);
        await db.chatroom_chats.toCollection().modify({ status: ChatStatus.Sent });

        await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS + 1);

        expect((await db.chatroom_chats.toArray())[0].status).toBe(ChatStatus.Sent);
    });

    it('keeps unsent local messages across a refresh', async () => {
        const chats = new ChatroomChats(ROOM);

        sendCOT.mockResolvedValue(false);
        await chats.send('never left', me, worker, peer);

        await db.chatroom_chats.put({
            id: 'stale', chatroom: ROOM, sender: NAME, sender_uid: peer.uid, message: 'gone', created: '2026-01-01T00:00:00.000Z'
        });

        remote([{ message_id: 'server-1', read: true }]);
        await chats.refresh();

        const messages = (await chats.list()).map((chat) => chat.message).sort();
        expect(messages).toEqual(['never left', 'server']);
    });

    it('acknowledges unread messages once', async () => {
        const chats = new ChatroomChats(ROOM);

        await chats.markRead();
        expect(server.PATCH).not.toHaveBeenCalled();

        remote([{ message_id: 'server-1', read: false }]);
        await chats.refresh();

        await chats.markRead();
        await chats.markRead();
        expect(server.PATCH).toHaveBeenCalledTimes(1);

        await db.chatroom.update(ROOM, { unread: 2 });
        await chats.markRead();
        expect(server.PATCH).toHaveBeenCalledTimes(2);
        expect((await db.chatroom.get(ROOM))?.unread).toBe(0);
        expect(server.PATCH.mock.calls[1][1].body).toEqual({ last_read: 'server-1' });
    });

    it('addresses a message to the UID the Chatroom is keyed by', async () => {
        const chats = new ChatroomChats(ROOM);

        sendCOT.mockResolvedValue(true);
        await chats.send('hello', me, worker);

        expect(sendCOT.mock.calls[0][0].to).toEqual(peer);
        expect(sendCOT.mock.calls[0][0].chatroom).toBe(NAME);
    });

    it('moves a Chatroom keyed by callsign onto the UID it resolves to', async () => {
        await db.chatroom.clear();
        await db.chatroom.put({ id: NAME, name: NAME, type: 'direct', created: '', updated: '', last_read: null });
        await db.chatroom_chats.put({
            id: 'old', chatroom: NAME, sender: NAME, sender_uid: peer.uid, message: 'earlier', created: '2026-01-01T00:00:00.000Z'
        });

        const chats = new ChatroomChats(NAME);

        sendCOT.mockResolvedValue(true);
        await chats.send('hello', me, worker);

        expect(chats.chatroom).toBe(ROOM);
        expect(await db.chatroom.get(NAME)).toBeUndefined();
        expect((await db.chatroom.get(ROOM))?.name).toBe(NAME);
        expect((await chats.list()).map((chat) => chat.message)).toEqual(['earlier', 'hello']);
    });

    it('addresses a Group Chatroom by its id', async () => {
        sendCOT.mockResolvedValue(true);
        await db.chatroom.put({
            id: 'group-1',
            name: 'Search Team',
            type: 'group',
            members: [{ uid: 'ANDROID-alpha', callsign: 'Alpha' }],
            created: '',
            updated: '',
            last_read: null
        });

        const chats = new ChatroomChats('group-1');

        await chats.send('hello', me, worker);

        expect(sendCOT.mock.calls[0][0].group).toBe('group-1');
        expect(sendCOT.mock.calls[0][0].chatroom).toBe('Search Team');
        expect(sendCOT.mock.calls[0][0].to).toBeUndefined();
        expect(chats.chatroom).toBe('group-1');
        expect((await chats.list())[0].status).toBe(ChatStatus.Sending);
    });

    it('does not send to a Group Chatroom with no known members', async () => {
        await db.chatroom.put({ id: 'group-1', name: 'Search Team', type: 'group', created: '', updated: '', last_read: null });

        const chats = new ChatroomChats('group-1');

        await chats.send('hello', me, worker);

        expect(sendCOT).not.toHaveBeenCalled();
        expect((await chats.list())[0].status).toBe(ChatStatus.Failed);
    });

    it('broadcasts to All Chat Rooms without members', async () => {
        sendCOT.mockResolvedValue(true);
        await db.chatroom.put({ id: BroadcastChatroom, name: BroadcastChatroom, type: 'group', created: '', updated: '', last_read: null });

        const chats = new ChatroomChats(BroadcastChatroom);

        await chats.send('hello', me, worker);

        expect(sendCOT.mock.calls[0][0].group).toBe(BroadcastChatroom);
    });
});
