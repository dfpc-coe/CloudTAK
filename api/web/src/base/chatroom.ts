import { db } from '../database.ts'
import type { DBChatroom } from '../database.ts';
import { server } from '../std.ts';
import ChatroomChats from './chatroom-chats.ts';
import { liveQuery, type Observable } from 'dexie';
import type {
    ProfileChatroomList,
    ProfileChatList
} from '../types.ts';

/**
 * High Level Wrapper around the Profile Chatroom API
 *
 * @property {string} name - The name of the chatroom
 */
export default class Chatroom {
    name: string;
    chats: ChatroomChats;

    constructor(
        name: string
    ) {
        this.name = name;
        this.chats = new ChatroomChats(name);
    }

    static liveUnreadCount(): Observable<number> {
        return liveQuery(async () => {
            const chatrooms = await db.chatroom.toArray();
            return chatrooms.reduce((acc, room) => acc + (room.unread || 0), 0);
        });
    }

    /**
     * Return a Chatroom instance if one already exists in the local DB,
     */
    static async from(
        name: string,
    ): Promise<Chatroom | undefined> {
        const exists = await db.chatroom
            .get(name)

        if (!exists) {
            return;
        }

        return new Chatroom(
            exists.name,
        );
    }

    /**
     * Loads an existing Chatroom from the local DB and refresh it,
     *
     * @param name - The unique identifier for the chatroom
     * @param opts - Options for loading the chatroom
     * @param opts.reload - Whether to reload the chatroom from the local DB
     */
    static async load(
        name: string,
        opts: {
            reload?: boolean,
        } = {}
    ): Promise<Chatroom> {
        const exists = await this.from(name);

        if (exists) {
            if (opts.reload !== false) {
                await exists.refresh();
            }

            return exists;
        } else {
            const room = new Chatroom(name);

            await db.chatroom.put({
                id: room.name,
                name: room.name,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                last_read: null
            });

            await room.refresh();

            return room;
        }
    }

    static async delete(names: string[]): Promise<void> {
        const res = await server.DELETE('/api/profile/chatroom', {
            params: { query: { chatroom: names } }
        });

        if (res.error && res.response.status !== 404) throw new Error(res.error.message);

        await db.chatroom.bulkDelete(names);
    }

    /**
     * Reload the Chatroom from the local Database
     */
    async reload(): Promise<void> {
        const exists = await db.chatroom
            .get(this.name)

        if (exists) {
            this.name = exists.name;
        }
    };

    /**
     * Perform a hard refresh of the Chatroom from the Server
     */
    async refresh(): Promise<void> {
        await this.fetch();
    };

    async fetch(): Promise<void> {
        const res = await server.GET('/api/profile/chatroom');

        if (res.error) throw new Error(res.error.message);

        const found = res.data.items.find((c) => c.chatroom === this.name);
        if (found) {
            this.name = found.chatroom;
        }
    }

    async getChats(): Promise<ProfileChatList> {
        const res = await server.GET('/api/profile/chatroom/{:chatroom}/chat', {
            params: {
                path: { ':chatroom': this.name },
                query: { limit: 100, page: 0, order: 'desc', sort: 'created' }
            }
        });

        if (res.error) throw new Error(res.error.message);

        return res.data;
    }
    async deleteChats(ids: string[]): Promise<void> {
        const res = await server.DELETE('/api/profile/chatroom/{:chatroom}/chat', {
            params: {
                path: { ':chatroom': this.name },
                query: { chat: ids }
            }
        });

        if (res.error) throw new Error(res.error.message);
    }

    /**
     * List all locally stored chatrooms
     */
    static async localList(): Promise<Set<{
        name: string;
    }>> {
        const list = await db.chatroom.toArray();

        const names = new Set<{
            name: string;
        }>();

        for (const sub of list) {
            names.add({
                name: sub.name,
            });
        }

        return names;
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

        const serverNames = new Set(list.items.map(c => c.chatroom));
        const local = await db.chatroom.toArray();

        for (const chat of local) {
            if (!serverNames.has(chat.name)) {
                await db.chatroom.delete(chat.id);
            }
        }

        for (const chat of list.items) {
            const externalChat = chat as { chatroom: string, updated?: string };
            const exists = await db.chatroom.get(chat.chatroom);
            if (!exists) {
                await db.chatroom.put({
                    id: chat.chatroom,
                    name: chat.chatroom,
                    created: externalChat.updated || new Date().toISOString(),
                    updated: externalChat.updated || new Date().toISOString(),
                    last_read: null
                });
            } else if (externalChat.updated && new Date(externalChat.updated).getTime() > new Date(exists.updated).getTime()) {
                await db.chatroom.update(chat.chatroom, {
                    updated: externalChat.updated
                });
            }
        }

        return list;
    }
}
