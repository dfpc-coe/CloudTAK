import { db, liveQuery } from '../database.ts'
import type { DBChatroom } from '../database.ts';
import { server } from '../std.ts';
import ChatroomChats from './chatroom-chats.ts';
import type { Observable } from 'dexie';
import type { Chatroom as APIChatroom, ChatroomList } from '../types.ts';

export type ChatroomContact = { uid: string, callsign: string };

/**
 * High Level Wrapper around the Chatroom API
 *
 * A Chatroom is shared by its Members - users of this server are reached directly,
 * every other Member through GeoChat on the TAK Server
 */
export default class Chatroom {
    id: string;
    name: string;
    type: DBChatroom['type'];
    chats: ChatroomChats;

    constructor(room: Pick<DBChatroom, 'id' | 'name' | 'type'>) {
        this.id = room.id;
        this.name = room.name;
        this.type = room.type;
        this.chats = new ChatroomChats(room.id);
    }

    static liveUnreadCount(): Observable<number> {
        return liveQuery(async () => {
            const chatrooms = await db.chatroom.toArray();
            return chatrooms.reduce((acc, room) => acc + (room.muted ? 0 : (room.unread || 0)), 0);
        });
    }

    static live(id: string): Observable<DBChatroom | undefined> {
        return liveQuery(async () => await db.chatroom.get(id));
    }

    /**
     * Store a Chatroom from the server, keeping what is only tracked locally
     */
    static async store(room: APIChatroom): Promise<DBChatroom> {
        const existing = await db.chatroom.get(room.id);
        const stored: DBChatroom = { ...room, synced: existing?.synced };

        await db.chatroom.put(stored);

        return stored;
    }

    static async from(id: string): Promise<Chatroom | undefined> {
        let room = await db.chatroom.get(id);

        if (!room) {
            const res = await server.GET('/api/chatroom/{:chatroom}', {
                params: { path: { ':chatroom': id } }
            });

            if (res.error) return undefined;

            room = await Chatroom.store(res.data);
        }

        return new Chatroom(room);
    }

    /**
     * The 1:1 Chatroom with a Contact, created on first use
     */
    static async direct(contact: ChatroomContact): Promise<Chatroom> {
        const res = await server.POST('/api/chatroom', {
            body: { type: 'direct', member: contact }
        });

        if (res.error) throw new Error(res.error.message);

        return new Chatroom(await Chatroom.store(res.data));
    }

    static async group(name: string, members: Array<ChatroomContact>): Promise<Chatroom> {
        const res = await server.POST('/api/chatroom', {
            body: { type: 'group', name, members }
        });

        if (res.error) throw new Error(res.error.message);

        return new Chatroom(await Chatroom.store(res.data));
    }

    async update(body: { name?: string, muted?: boolean }): Promise<void> {
        const res = await server.PATCH('/api/chatroom/{:chatroom}', {
            params: { path: { ':chatroom': this.id } },
            body
        });

        if (res.error) throw new Error(res.error.message);

        this.name = res.data.name;
        await Chatroom.store(res.data);
    }

    /**
     * Replace the Members of a Group - only its owner can
     */
    async members(members: Array<ChatroomContact>): Promise<void> {
        const res = await server.PUT('/api/chatroom/{:chatroom}/member', {
            params: { path: { ':chatroom': this.id } },
            body: { members }
        });

        if (res.error) throw new Error(res.error.message);

        await Chatroom.store(res.data);
    }

    static async forget(ids: string[]): Promise<void> {
        await db.chatroom_chats.where('chatroom').anyOf(ids).delete();
        await db.chatroom.bulkDelete(ids);
    }

    /**
     * Leave Chatrooms - the owner of a Group deletes it for every Member
     */
    static async delete(ids: string[]): Promise<void> {
        for (const id of ids) {
            const res = await server.DELETE('/api/chatroom/{:chatroom}', {
                params: { path: { ':chatroom': id } }
            });

            if (res.error && res.response.status !== 404) throw new Error(res.error.message);
        }

        await Chatroom.forget(ids);
    }

    static async list(filter?: string): Promise<DBChatroom[]> {
        let collection = db.chatroom.toCollection();

        if (filter) {
            collection = collection.filter((room) => {
                return room.name.toLowerCase().includes(filter.toLowerCase());
            });
        }

        return (await collection.sortBy('updated')).reverse();
    }

    static async sync(): Promise<ChatroomList> {
        const res = await server.GET('/api/chatroom');

        if (res.error) throw new Error(res.error.message);

        const list = res.data;

        const remote = new Set(list.items.map((room) => room.id));
        const stale = (await db.chatroom.toArray())
            .map((room) => room.id)
            .filter((id) => !remote.has(id));

        if (stale.length) await Chatroom.forget(stale);

        for (const room of list.items) await Chatroom.store(room);

        return list;
    }
}
