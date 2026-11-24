import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
}));

vi.mock('../std.ts', () => ({ server }));

import { db, ChatStatus } from '../database.ts';
import type { DBChatroom } from '../database.ts';
import ChatroomChats, { storeChat } from '../base/chatroom-chats.ts';
import Chatroom from '../base/chatroom.ts';
import type { ChatMessage } from '../types.ts';

const ROOM = '3f0c6a0e-0000-4000-8000-000000000001';
const me = { uid: 'ANDROID-CloudTAK-me@example.com', callsign: 'ME' };
const peer = { uid: 'ANDROID-alpha', callsign: 'ALPHA' };

function room(overrides: Partial<DBChatroom> = {}): DBChatroom {
    return {
        id: ROOM,
        type: 'direct',
        name: peer.callsign,
        role: 'member',
        muted: false,
        members: [
            { ...me, role: 'member', local: true },
            { ...peer, role: 'member', local: false },
        ],
        created: '2026-01-01T00:00:00.000000Z',
        updated: '2026-01-01T00:00:00.000000Z',
        unread: 0,
        last_read: null,
        ...overrides,
    };
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: crypto.randomUUID(),
        chatroom: ROOM,
        created: '2026-01-01T00:00:00.000000Z',
        updated: '2026-01-01T00:00:00.000000Z',
        sender_uid: peer.uid,
        sender_callsign: peer.callsign,
        body: 'server',
        reply_to: null,
        metadata: {},
        edited: null,
        deleted: null,
        status: null,
        reactions: [],
        ...overrides,
    };
}

describe('ChatroomChats', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await db.chatroom.clear();
        await db.chatroom_chats.clear();
        await db.chatroom.put(room());
    });

    it('sends over the API under a client generated id and stores what the server returns', async () => {
        server.POST.mockImplementation(async (_url: string, req: { body: { id: string; body: string } }) => ({
            data: message({ id: req.body.id, body: req.body.body, sender_uid: me.uid, sender_callsign: me.callsign, status: 'sent' }),
        }));

        const chats = new ChatroomChats(ROOM);
        await chats.send('hello', me, { reply_to: 'parent-id', location: [-105, 39] });

        const body = server.POST.mock.calls[0][1].body;
        expect(body.body).toBe('hello');
        expect(body.reply_to).toBe('parent-id');
        expect(body.metadata).toEqual({ location: [-105, 39] });

        const [stored] = await chats.list();
        expect(stored.id).toBe(body.id);
        expect(stored.status).toBe(ChatStatus.Sent);
    });

    it('fails a message the server rejects and resends it under the same id', async () => {
        server.POST.mockResolvedValueOnce({ error: { message: 'offline' } });

        const chats = new ChatroomChats(ROOM);
        await chats.send('hello', me);

        const [failed] = await chats.list();
        expect(failed.status).toBe(ChatStatus.Failed);

        server.POST.mockImplementation(async (_url: string, req: { body: { id: string } }) => ({
            data: message({ id: req.body.id, body: 'hello', sender_uid: me.uid, status: 'sent' }),
        }));

        await chats.retry(failed.id);

        expect(server.POST.mock.calls[1][1].body.id).toBe(failed.id);
        expect((await chats.list()).map((chat) => chat.status)).toEqual([ChatStatus.Sent]);
    });

    it('keeps the status the server reports as failed so the sender can retry', async () => {
        server.POST.mockImplementation(async (_url: string, req: { body: { id: string } }) => ({
            data: message({ id: req.body.id, sender_uid: me.uid, status: 'failed' }),
        }));

        const chats = new ChatroomChats(ROOM);
        await chats.send('hello', me);

        expect((await chats.list())[0].status).toBe(ChatStatus.Failed);
    });

    it('merges a refresh into what is stored, then only asks for what changed', async () => {
        const first = message({ body: 'first', updated: '2026-01-01T00:00:01.000000Z' });
        await db.chatroom_chats.put({
            id: 'local-unsent',
            chatroom: ROOM,
            sender: me.callsign,
            sender_uid: me.uid,
            message: 'unsent',
            created: new Date().toISOString(),
            status: ChatStatus.Sending,
        });

        server.GET.mockResolvedValueOnce({ data: { total: 80, items: [first] } });

        const chats = new ChatroomChats(ROOM);
        await chats.refresh();

        expect(chats.more).toBe(true);
        expect(server.GET.mock.calls[0][1].params.query).toEqual({ limit: 50 });
        expect((await chats.list()).map((chat) => chat.message).sort()).toEqual(['first', 'unsent']);

        server.GET.mockResolvedValueOnce({
            data: { total: 1, items: [{ ...first, body: 'first (edited)', edited: '2026-01-01T00:00:02.000000Z', updated: '2026-01-01T00:00:02.000000Z' }] },
        });

        await chats.refresh();

        expect(server.GET.mock.calls[1][1].params.query).toEqual({ limit: 200, since: '2026-01-01T00:00:01.000000Z' });
        expect((await db.chatroom_chats.get(first.id))?.message).toBe('first (edited)');
        expect((await db.chatroom.get(ROOM))?.synced).toBe('2026-01-01T00:00:02.000000Z');
    });

    it('pages older messages from the oldest stored one', async () => {
        const newest = message({ created: '2026-01-02T00:00:00.000000Z' });
        const oldest = message({ created: '2026-01-01T00:00:00.000000Z' });
        await storeChat(newest);
        await storeChat(oldest);

        server.GET.mockResolvedValueOnce({ data: { total: 1, items: [message({ created: '2025-12-31T00:00:00.000000Z' })] } });

        const chats = new ChatroomChats(ROOM);
        await chats.older();

        expect(server.GET.mock.calls[0][1].params.query).toEqual({ limit: 50, before: oldest.id });
        expect(chats.more).toBe(false);
        expect(await db.chatroom_chats.count()).toBe(3);
    });

    it('acknowledges unread messages once', async () => {
        const unread = message();
        await storeChat(unread);
        await db.chatroom.update(ROOM, { unread: 1 });

        server.PATCH.mockResolvedValue({ data: { last_read: unread.created, unread: 0 } });

        const chats = new ChatroomChats(ROOM);
        await chats.markRead();
        await chats.markRead();

        expect(server.PATCH).toHaveBeenCalledTimes(1);
        expect(server.PATCH.mock.calls[0][1].body).toEqual({ last_read: unread.id });
        expect((await db.chatroom.get(ROOM))?.unread).toBe(0);
    });

    it('never moves the delivery status of a message backwards', async () => {
        const sent = message({ sender_uid: me.uid, status: 'read' });
        await storeChat(sent);

        expect(await storeChat({ ...sent, status: 'delivered' })).toBe(false);
        expect((await db.chatroom_chats.get(sent.id))?.status).toBe(ChatStatus.Read);
    });

    it('deletes a message that never reached the server locally', async () => {
        await db.chatroom_chats.put({
            id: 'local-failed',
            chatroom: ROOM,
            sender: me.callsign,
            sender_uid: me.uid,
            message: 'failed',
            created: new Date().toISOString(),
            status: ChatStatus.Failed,
        });

        await new ChatroomChats(ROOM).remove('local-failed');

        expect(server.DELETE).not.toHaveBeenCalled();
        expect(await db.chatroom_chats.count()).toBe(0);
    });
});

describe('Chatroom', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await db.chatroom.clear();
        await db.chatroom_chats.clear();
    });

    it('drops Chatrooms the server no longer lists and keeps the sync position of the rest', async () => {
        await db.chatroom.put(room({ synced: '2026-01-01T00:00:01.000000Z' }));
        await db.chatroom.put(room({ id: 'stale' }));
        await db.chatroom_chats.put({ id: 'm', chatroom: 'stale', sender: '', sender_uid: '', message: '', created: '' });

        const { synced: _synced, ...listed } = room({ unread: 3 });
        void _synced;

        server.GET.mockResolvedValue({ data: { total: 1, items: [listed] } });

        await Chatroom.sync();

        expect(await db.chatroom.get('stale')).toBeUndefined();
        expect(await db.chatroom_chats.count()).toBe(0);
        expect((await db.chatroom.get(ROOM))?.unread).toBe(3);
        expect((await db.chatroom.get(ROOM))?.synced).toBe('2026-01-01T00:00:01.000000Z');
    });

    it('opens the Direct Chatroom of a Contact through the API', async () => {
        server.POST.mockResolvedValue({ data: room() });

        const opened = await Chatroom.direct(peer);

        expect(server.POST.mock.calls[0][1].body).toEqual({ type: 'direct', member: peer });
        expect(opened.id).toBe(ROOM);
        expect((await db.chatroom.get(ROOM))?.name).toBe(peer.callsign);
    });

    it('does not count muted Chatrooms as unread', async () => {
        await db.chatroom.put(room({ unread: 2 }));
        await db.chatroom.put(room({ id: 'muted', unread: 5, muted: true }));

        const count = await new Promise<number>((resolve) => {
            const sub = Chatroom.liveUnreadCount().subscribe((value) => {
                resolve(value);
                queueMicrotask(() => sub.unsubscribe());
            });
        });

        expect(count).toBe(2);
    });
});
