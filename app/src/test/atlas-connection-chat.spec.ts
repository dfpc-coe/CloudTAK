import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const server = vi.hoisted(() => ({
    GET: vi.fn(async () => ({ data: { total: 0, items: [] } })),
}));

const notify = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../std.ts', () => ({ server, std: vi.fn(), stdurl: (url: string) => new URL(url, 'http://localhost') }));
vi.mock('../base/notification.ts', () => ({
    default: { create: notify },
    NotificationType: { Chat: 'Chat' },
}));

import { db } from '../database.ts';
import AtlasConnection from '../workers/atlas-connection.ts';
import type Atlas from '../workers/atlas.ts';

class FakeSocket {
    static instances: FakeSocket[] = [];
    readyState = 0;
    listeners = new Map<string, Array<(ev?: unknown) => void>>();
    constructor(public url: string) { FakeSocket.instances.push(this); }
    addEventListener(type: string, fn: (ev?: unknown) => void) {
        const list = this.listeners.get(type) ?? [];
        list.push(fn);
        this.listeners.set(type, list);
    }
    emit(type: string, ev?: unknown) {
        for (const fn of this.listeners.get(type) ?? []) fn(ev);
    }
    open() { this.readyState = 1; this.emit('open'); }
    close() { this.readyState = 3; }
    send() { /* noop */ }
}

const room = {
    id: '3f0c6a0e-0000-4000-8000-000000000001',
    type: 'direct',
    name: 'ALPHA',
    role: 'member',
    muted: false,
    members: [],
    created: '2026-01-01T00:00:00.000000Z',
    updated: '2026-01-01T00:00:00.000000Z',
    unread: 0,
    last_read: null,
};

const chat = {
    type: 'chat',
    connection: 'me@example.com',
    data: {
        chatroom: { id: room.id, type: 'direct', name: 'ALPHA', muted: false },
        message: {
            id: 'message-1',
            chatroom: room.id,
            created: '2026-01-01T00:00:01.000000Z',
            updated: '2026-01-01T00:00:01.000000Z',
            sender_uid: 'ANDROID-alpha',
            sender_callsign: 'ALPHA',
            body: 'hello',
            reply_to: null,
            metadata: {},
            edited: null,
            deleted: null,
            status: null,
            reactions: [],
        },
    },
};

function atlasMock(): Atlas {
    return {
        token: 'token',
        profile: {
            profile_callsign: { value: 'ME' },
            username: 'me@example.com',
            uid: () => 'ANDROID-CloudTAK-me@example.com',
        },
        sync: { started: false, fullSync: vi.fn(async () => undefined) },
        postMessage: vi.fn(async () => undefined),
    } as unknown as Atlas;
}

describe('AtlasConnection chat', () => {
    beforeEach(async () => {
        FakeSocket.instances = [];
        vi.clearAllMocks();
        vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1 }));
        vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
        await db.chatroom.clear();
        await db.chatroom_chats.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('treats a redelivered message as already seen', async () => {
        server.GET.mockResolvedValue({ data: room } as never);

        const conn = new AtlasConnection(atlasMock());
        conn.connect('me@example.com');
        const sock = FakeSocket.instances[0];
        sock.open();

        sock.emit('message', { data: JSON.stringify(chat) });
        await vi.waitFor(async () => expect(await db.chatroom_chats.count()).toBe(1));
        await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));

        expect((await db.chatroom.get(room.id))?.unread).toBe(1);
        expect(notify.mock.calls[0]).toContain(`/menu/chats/${room.id}`);

        await db.chatroom.update(room.id, { unread: 0 });

        sock.emit('message', { data: JSON.stringify(chat) });
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(await db.chatroom_chats.count()).toBe(1);
        expect((await db.chatroom.get(room.id))?.unread).toBe(0);
        expect(notify).toHaveBeenCalledTimes(1);

        conn.destroy();
    });

    it('does not notify for the echo of a sent message or in a muted Chatroom', async () => {
        await db.chatroom.put(room as never);

        const conn = new AtlasConnection(atlasMock());
        conn.connect('me@example.com');
        const sock = FakeSocket.instances[0];
        sock.open();

        sock.emit('message', {
            data: JSON.stringify({
                ...chat,
                data: { ...chat.data, message: { ...chat.data.message, id: 'own', sender_uid: 'ANDROID-CloudTAK-me@example.com' } },
            }),
        });

        sock.emit('message', {
            data: JSON.stringify({
                ...chat,
                data: { chatroom: { ...chat.data.chatroom, muted: true }, message: { ...chat.data.message, id: 'muted' } },
            }),
        });

        await vi.waitFor(async () => expect(await db.chatroom_chats.count()).toBe(2));
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(notify).not.toHaveBeenCalled();
        expect((await db.chatroom.get(room.id))?.unread).toBe(1);

        conn.destroy();
    });

    it('applies changes to messages & Chatrooms and drops a Chatroom the user left', async () => {
        await db.chatroom.put(room as never);

        const conn = new AtlasConnection(atlasMock());
        conn.connect('me@example.com');
        const sock = FakeSocket.instances[0];
        sock.open();

        sock.emit('message', { data: JSON.stringify(chat) });
        await vi.waitFor(async () => expect(await db.chatroom_chats.count()).toBe(1));

        sock.emit('message', {
            data: JSON.stringify({
                ...chat,
                type: 'chat:update',
                data: { ...chat.data, message: { ...chat.data.message, body: 'edited', edited: '2026-01-01T00:00:02.000000Z' } },
            }),
        });

        await vi.waitFor(async () => expect((await db.chatroom_chats.get('message-1'))?.message).toBe('edited'));
        expect(notify).toHaveBeenCalledTimes(1);

        sock.emit('message', {
            data: JSON.stringify({ type: 'chatroom', connection: 'me@example.com', data: { ...room, name: 'Renamed' } }),
        });

        await vi.waitFor(async () => expect((await db.chatroom.get(room.id))?.name).toBe('Renamed'));

        sock.emit('message', {
            data: JSON.stringify({ type: 'chatroom:delete', connection: 'me@example.com', data: { id: room.id } }),
        });

        await vi.waitFor(async () => expect(await db.chatroom.get(room.id)).toBeUndefined());
        expect(await db.chatroom_chats.count()).toBe(0);

        conn.destroy();
    });
});
