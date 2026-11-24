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

const chat = {
    type: 'chat',
    connection: 'me@example.com',
    data: {
        chatroom: 'ME',
        room: { id: 'ANDROID-alpha', name: 'ALPHA', type: 'direct' },
        messageId: 'message-1',
        from: { uid: 'ANDROID-alpha', callsign: 'ALPHA' },
        message: 'hello',
        time: '2026-01-01T00:00:00.000Z',
    },
};

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
        const atlas = {
            token: 'token',
            profile: { profile_callsign: { value: 'ME' }, username: 'me@example.com' },
            sync: { started: false, fullSync: vi.fn(async () => undefined) },
            postMessage: vi.fn(async () => undefined),
        } as unknown as Atlas;

        const conn = new AtlasConnection(atlas);
        conn.connect('me@example.com');
        const sock = FakeSocket.instances[0];
        sock.open();

        sock.emit('message', { data: JSON.stringify(chat) });
        await vi.waitFor(async () => expect(await db.chatroom_chats.count()).toBe(1));
        await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));

        await db.chatroom.update('ANDROID-alpha', { unread: 0 });

        sock.emit('message', { data: JSON.stringify(chat) });
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(await db.chatroom_chats.count()).toBe(1);
        expect((await db.chatroom.get('ANDROID-alpha'))?.unread).toBe(0);
        expect(notify).toHaveBeenCalledTimes(1);

        conn.destroy();
    });

    it('stores the members of a Group Chatroom and drops a Group its owner deleted', async () => {
        const atlas = {
            token: 'token',
            profile: { profile_callsign: { value: 'ME' }, username: 'me@example.com' },
            sync: { started: false, fullSync: vi.fn(async () => undefined) },
            postMessage: vi.fn(async () => undefined),
        } as unknown as Atlas;

        const conn = new AtlasConnection(atlas);
        conn.connect('me@example.com');
        const sock = FakeSocket.instances[0];
        sock.open();

        const members = [{ uid: 'ANDROID-alpha', callsign: 'ALPHA' }];

        sock.emit('message', {
            data: JSON.stringify({
                ...chat,
                data: { ...chat.data, room: { id: 'group-1', name: 'Search Team', type: 'group', members } },
            }),
        });

        await vi.waitFor(async () => expect((await db.chatroom.get('group-1'))?.members).toEqual(members));
        expect(await db.chatroom_chats.count()).toBe(1);

        sock.emit('message', {
            data: JSON.stringify({ type: 'chatroom:delete', connection: 'me@example.com', data: { id: 'group-1' } }),
        });

        await vi.waitFor(async () => expect(await db.chatroom.get('group-1')).toBeUndefined());
        expect(await db.chatroom_chats.count()).toBe(0);

        conn.destroy();
    });
});
