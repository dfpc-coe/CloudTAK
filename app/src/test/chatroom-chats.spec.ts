import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
    DELETE: vi.fn(),
}));

vi.mock('../std.ts', () => ({ server }));

import { db, ChatStatus } from '../database.ts';
import ChatroomChats, { SEND_TIMEOUT_MS } from '../base/chatroom-chats.ts';
import type Atlas from '../workers/atlas.ts';
import type { Remote } from 'comlink';

const ROOM = 'ALPHA';
const me = { uid: 'ANDROID-CloudTAK-me@example.com', callsign: 'ME' };
const peer = { uid: 'ANDROID-alpha', callsign: ROOM };

const sendCOT = vi.fn();
const worker = { conn: { sendCOT }, profile: { location: undefined } } as unknown as Remote<Atlas>;

function remote(items: Array<{ message_id: string; read: boolean; status?: string | null }>): void {
    server.GET.mockResolvedValue({
        data: {
            total: items.length,
            items: items.map((item) => ({
                sender_callsign: ROOM,
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
        await db.chatroom.put({ id: ROOM, name: ROOM, created: '', updated: '', last_read: null });
        server.POST.mockResolvedValue({ data: { status: 200, message: '' } });
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
            id: 'stale', chatroom: ROOM, sender: ROOM, sender_uid: peer.uid, message: 'gone', created: '2026-01-01T00:00:00.000Z'
        });

        remote([{ message_id: 'server-1', read: true }]);
        await chats.refresh();

        const messages = (await chats.list()).map((chat) => chat.message).sort();
        expect(messages).toEqual(['never left', 'server']);
    });

    it('acknowledges unread messages once', async () => {
        const chats = new ChatroomChats(ROOM);

        await chats.markRead();
        expect(server.POST).not.toHaveBeenCalled();

        remote([{ message_id: 'server-1', read: false }]);
        await chats.refresh();

        await chats.markRead();
        await chats.markRead();
        expect(server.POST).toHaveBeenCalledTimes(1);

        await db.chatroom.update(ROOM, { unread: 2 });
        await chats.markRead();
        expect(server.POST).toHaveBeenCalledTimes(2);
        expect((await db.chatroom.get(ROOM))?.unread).toBe(0);
    });
});
