import { db } from './database.ts'
import type { DBChatroom } from './database.ts';
import { std, stdurl } from '../std.ts';
import ChatroomChats from './chatroom-chats.ts';
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
        const url = stdurl('/api/profile/chatroom');
        for (const name of names) {
            url.searchParams.append('chatroom', name);
        }

        await std(url, {
            method: 'DELETE'
        });

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
        const url = stdurl('/api/profile/chatroom');

        const list = await std(url) as ProfileChatroomList;

        const found = list.items.find((c) => c.chatroom === this.name);
        if (found) {
            this.name = found.chatroom;
        }
    }

    async getChats(): Promise<ProfileChatList> {
        const url = stdurl(`/api/profile/chatroom/${encodeURIComponent(this.name)}/chat`);
        return await std(url) as ProfileChatList;
    }
    async deleteChats(ids: string[]): Promise<void> {
        const url = stdurl(`/api/profile/chatroom/${encodeURIComponent(this.name)}/chat`);
        for (const id of ids) {
            url.searchParams.append('chat', id);
        }

        await std(url, {
            method: 'DELETE'
        });
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

        return (await collection.sortBy('name')).reverse();
    }

    static async sync(): Promise<ProfileChatroomList> {
        const url = stdurl('/api/profile/chatroom');

        const list = await std(url) as ProfileChatroomList;

        const serverNames = new Set(list.items.map(c => c.chatroom));
        const local = await db.chatroom.toArray();

        for (const chat of local) {
            if (!serverNames.has(chat.name)) {
                await db.chatroom.delete(chat.id);
            }
        }

        for (const chat of list.items) {
            const exists = await db.chatroom.get(chat.chatroom);
            if (!exists) {
                await db.chatroom.put({
                    id: chat.chatroom,
                    name: chat.chatroom,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    last_read: null
                });
            }
        }

        return list;
    }
}
