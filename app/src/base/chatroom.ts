import { db, liveQuery } from '../database.ts'
import type { DBChatroom } from '../database.ts';
import { server } from '../std.ts';
import ChatroomChats, { rekeyChatroom, BroadcastChatroom } from './chatroom-chats.ts';
import type { Observable } from 'dexie';
import type { ProfileChatroomList } from '../types.ts';

/**
 * High Level Wrapper around the Profile Chatroom API
 *
 * A Direct Chatroom is keyed by the UID of the other party, a Group Chatroom by its GeoChat id
 */
export default class Chatroom {
    id: string;
    name: string;
    type: 'direct' | 'group';
    chats: ChatroomChats;

    constructor(room: Pick<DBChatroom, 'id' | 'name' | 'type'>) {
        this.id = room.id;
        this.name = room.name;
        this.type = room.type ?? 'direct';
        this.chats = new ChatroomChats(room.id);
    }

    static liveUnreadCount(): Observable<number> {
        return liveQuery(async () => {
            const chatrooms = await db.chatroom.toArray();
            return chatrooms.reduce((acc, room) => acc + (room.unread || 0), 0);
        });
    }

    static live(id: string): Observable<DBChatroom | undefined> {
        return liveQuery(async () => await db.chatroom.get(id));
    }

    static async from(id: string): Promise<Chatroom | undefined> {
        const exists = await db.chatroom.get(id);
        if (!exists) return;

        return new Chatroom(exists);
    }

    /**
     * Load a Chatroom from the local DB, creating it locally if it is not yet known
     */
    static async load(
        id: string,
        opts: {
            name?: string,
            type?: 'direct' | 'group',
        } = {}
    ): Promise<Chatroom> {
        const exists = await db.chatroom.get(id);

        if (exists) {
            if (opts.name && opts.name !== exists.name) {
                exists.name = opts.name;
                await db.chatroom.update(id, { name: opts.name });
            }

            return new Chatroom(exists);
        }

        const now = new Date().toISOString();
        const room: DBChatroom = {
            id,
            name: opts.name || id,
            type: opts.type || 'direct',
            created: now,
            updated: now,
            last_read: null
        };

        await db.chatroom.put(room);

        return new Chatroom(room);
    }

    /**
     * Move a Chatroom that was keyed by callsign onto the UID behind it
     */
    static async rekey(from: string, to: string, name?: string): Promise<void> {
        await rekeyChatroom(from, to, name);
    }

    static async delete(ids: string[]): Promise<void> {
        const res = await server.DELETE('/api/profile/chatroom', {
            params: { query: { chatroom: ids } }
        });

        if (res.error && res.response.status !== 404) throw new Error(res.error.message);

        await db.chatroom_chats.where('chatroom').anyOf(ids).delete();
        await db.chatroom.bulkDelete(ids);
    }

    async deleteChats(ids: string[]): Promise<void> {
        const res = await server.DELETE('/api/profile/chatroom/{:chatroom}/chat', {
            params: {
                path: { ':chatroom': this.id },
                query: { chat: ids }
            }
        });

        if (res.error) throw new Error(res.error.message);
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

    static async sync(): Promise<ProfileChatroomList> {
        const res = await server.GET('/api/profile/chatroom');

        if (res.error) throw new Error(res.error.message);

        const list = res.data;

        const remote = new Set(list.items.map((room) => room.id));
        const stale = (await db.chatroom.toArray())
            .map((room) => room.id)
            .filter((id) => !remote.has(id) && id !== BroadcastChatroom);

        if (stale.length) {
            await db.chatroom_chats.where('chatroom').anyOf(stale).delete();
            await db.chatroom.bulkDelete(stale);
        }

        await db.chatroom.bulkPut(list.items.map((room) => ({
            id: room.id,
            name: room.name,
            type: room.type,
            members: room.members,
            created: new Date(room.created).toISOString(),
            updated: new Date(room.updated).toISOString(),
            unread: room.unread,
            last_read: room.last_read
        })));

        if (!remote.has(BroadcastChatroom)) {
            await Chatroom.load(BroadcastChatroom, { type: 'group' });
        }

        return list;
    }
}
