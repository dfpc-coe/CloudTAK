import { db } from '../database.ts';
import { server } from '../std.ts';
import type { ChatMessage } from '../types.ts';
import type { DBChatroomChat } from '../database.ts';
import { ChatStatus, ChatStatusRank } from '../database.ts';

export const SEND_TIMEOUT_MS = 15000;

const PAGE = 50;

type Sendable = { status?: ChatStatus, created: string };

export function isUnsent(chat: Sendable): boolean {
    return chat.status === ChatStatus.Sending || chat.status === ChatStatus.Failed;
}

/** A message the server never acknowledged is presented as failed */
export function expireSending<T extends Sendable>(chats: T[]): T[] {
    const cutoff = Date.now() - SEND_TIMEOUT_MS;

    return chats.map((chat) => {
        if (chat.status !== ChatStatus.Sending || new Date(chat.created).getTime() >= cutoff) return chat;
        return { ...chat, status: ChatStatus.Failed };
    });
}

export function failIfSending(chat: Sendable): void {
    if (chat.status === ChatStatus.Sending) chat.status = ChatStatus.Failed;
}

export function toChat(message: ChatMessage): DBChatroomChat {
    return {
        id: message.id,
        chatroom: message.chatroom,
        sender: message.sender_callsign,
        sender_uid: message.sender_uid,
        message: message.body,
        created: message.created,
        updated: message.updated,
        status: (message.status as ChatStatus | null) ?? undefined,
        reply_to: message.reply_to,
        edited: message.edited,
        deleted: message.deleted,
        reactions: message.reactions
    };
}

/**
 * Store a Message from the server, returning true if it was not known before
 * The delivery status of a Message only ever moves forward
 */
export async function storeChat(message: ChatMessage): Promise<boolean> {
    return await db.transaction('rw', db.chatroom_chats, async () => {
        const existing = await db.chatroom_chats.get(message.id);
        const chat = toChat(message);

        if (existing?.status && existing.status !== ChatStatus.Sending && existing.status !== ChatStatus.Failed) {
            const known = ChatStatusRank[existing.status];
            if (!chat.status || ChatStatusRank[chat.status] < known) chat.status = existing.status;
        }

        await db.chatroom_chats.put(chat);

        return !existing;
    });
}

export default class ChatroomChats {
    chatroom: string;

    // Older Messages exist on the server than are stored locally
    more = false;

    constructor(
        chatroom: string
    ) {
        this.chatroom = chatroom;
    }

    /**
     * Fetch the newest Messages, or everything that changed since the last refresh
     */
    async refresh(): Promise<void> {
        const room = await db.chatroom.get(this.chatroom);

        const res = await server.GET('/api/chatroom/{:chatroom}/message', {
            params: {
                path: { ':chatroom': this.chatroom },
                query: room?.synced ? { limit: 200, since: room.synced } : { limit: PAGE }
            }
        });

        if (res.error) throw new Error(res.error.message);

        for (const message of res.data.items) await storeChat(message);

        if (!room?.synced) this.more = res.data.total > res.data.items.length;

        const synced = res.data.items.reduce((newest, message) => {
            return message.updated > newest ? message.updated : newest;
        }, room?.synced ?? '');

        if (synced) await db.chatroom.update(this.chatroom, { synced });
    }

    /**
     * Fetch the page of Messages before the oldest one stored locally
     */
    async older(): Promise<void> {
        const oldest = (await this.list()).find((chat) => !isUnsent(chat));
        if (!oldest) return;

        const res = await server.GET('/api/chatroom/{:chatroom}/message', {
            params: {
                path: { ':chatroom': this.chatroom },
                query: { limit: PAGE, before: oldest.id }
            }
        });

        if (res.error) throw new Error(res.error.message);

        for (const message of res.data.items) await storeChat(message);

        this.more = res.data.total > res.data.items.length;
    }

    async search(filter: string): Promise<Array<DBChatroomChat>> {
        const res = await server.GET('/api/chatroom/{:chatroom}/message', {
            params: {
                path: { ':chatroom': this.chatroom },
                query: { limit: PAGE, filter }
            }
        });

        if (res.error) throw new Error(res.error.message);

        return res.data.items.map(toChat).reverse();
    }

    async list(
        opts?: {
            refresh?: boolean,
        }
    ): Promise<Array<DBChatroomChat>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        const chats = await db.chatroom_chats
            .where("chatroom")
            .equals(this.chatroom)
            .toArray();

        chats.sort((a, b) => {
            return new Date(a.created).getTime() - new Date(b.created).getTime();
        });

        return expireSending(chats);
    }

    async markRead(): Promise<void> {
        const room = await db.chatroom.get(this.chatroom);
        if (!room?.unread) return;

        const newest = (await this.list()).filter((chat) => !isUnsent(chat)).pop();
        if (!newest) return;

        await db.chatroom.update(this.chatroom, { unread: 0 });

        const res = await server.PATCH('/api/chatroom/{:chatroom}', {
            params: { path: { ':chatroom': this.chatroom } },
            body: { last_read: newest.id }
        });

        if (res.error) {
            await db.chatroom.update(this.chatroom, { unread: room.unread });
            console.error('Failed to mark Chats as read', res.error);
            return;
        }

        await db.chatroom.update(this.chatroom, { last_read: res.data.last_read, unread: res.data.unread });
    }

    async send(
        message: string,
        sender: { uid: string, callsign: string },
        opts: { reply_to?: string, location?: number[] } = {}
    ): Promise<void> {
        const chat: DBChatroomChat = {
            id: crypto.randomUUID(),
            chatroom: this.chatroom,
            sender: sender.callsign,
            sender_uid: sender.uid,
            message: message,
            created: new Date().toISOString(),
            status: ChatStatus.Sending,
            reply_to: opts.reply_to ?? null
        };

        await db.chatroom.update(this.chatroom, {
            updated: chat.created
        });

        await db.chatroom_chats.put(chat);

        await this.dispatch(chat, opts.location);
    }

    /**
     * Resend a message under its original id so recipients that did get it don't see it twice
     */
    async retry(id: string): Promise<void> {
        const chat = await db.chatroom_chats.get(id);
        if (!chat) return;

        chat.status = ChatStatus.Sending;
        chat.created = new Date().toISOString();

        await db.chatroom_chats.put(chat);

        await this.dispatch(chat);
    }

    private async dispatch(chat: DBChatroomChat, location?: number[]): Promise<void> {
        try {
            const res = await server.POST('/api/chatroom/{:chatroom}/message', {
                params: { path: { ':chatroom': this.chatroom } },
                body: {
                    id: chat.id,
                    body: chat.message,
                    ...(chat.reply_to ? { reply_to: chat.reply_to } : {}),
                    ...(location && (location[0] !== 0 || location[1] !== 0) ? { metadata: { location } } : {})
                },
                signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
            });

            if (res.error) throw new Error(res.error.message);

            await db.chatroom_chats.put(toChat(res.data));
        } catch (err) {
            console.error('Failed to send Chat', err);
            await db.chatroom_chats.where('id').equals(chat.id).modify(failIfSending);
        }
    }

    async edit(id: string, message: string): Promise<void> {
        const res = await server.PATCH('/api/chatroom/{:chatroom}/message/{:message}', {
            params: { path: { ':chatroom': this.chatroom, ':message': id } },
            body: { body: message }
        });

        if (res.error) throw new Error(res.error.message);

        await storeChat(res.data);
    }

    async remove(id: string): Promise<void> {
        const chat = await db.chatroom_chats.get(id);

        // A Message that never reached the server only exists here
        if (chat && isUnsent(chat)) {
            await db.chatroom_chats.delete(id);
            return;
        }

        const res = await server.DELETE('/api/chatroom/{:chatroom}/message/{:message}', {
            params: { path: { ':chatroom': this.chatroom, ':message': id } }
        });

        if (res.error) throw new Error(res.error.message);

        await storeChat(res.data);
    }

    async react(id: string, emoji: string, active: boolean): Promise<void> {
        const res = await server.PUT('/api/chatroom/{:chatroom}/message/{:message}/reaction', {
            params: { path: { ':chatroom': this.chatroom, ':message': id } },
            body: { emoji, active }
        });

        if (res.error) throw new Error(res.error.message);

        await storeChat(res.data);
    }
}
