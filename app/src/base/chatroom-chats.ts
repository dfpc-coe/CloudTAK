import { db } from '../database.ts';
import { server } from '../std.ts';
import type {
    ProfileChatList,
    APIProfileChat
} from '../types.ts'
import type { DBChatroomChat } from '../database.ts';
import { ChatStatus } from '../database.ts';
import type Atlas from '../workers/atlas.ts';
import type { Remote } from 'comlink';
import ContactManager from './contact.ts';

export const SEND_TIMEOUT_MS = 15000;

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

export default class ChatroomChats {
    chatroom: string;

    // The server holds unread messages that have not been acknowledged with a Read Receipt
    unacked = false;

    constructor(
        chatroom: string
    ) {
        this.chatroom = chatroom;
    }

    async refresh(): Promise<void> {
        const res = await server.GET('/api/profile/chatroom/{:chatroom}/chat', {
            params: {
                path: { ':chatroom': this.chatroom },
                query: { limit: 50, page: 0, order: 'desc', sort: 'created' }
            }
        });

        if (res.error) throw new Error(res.error.message);

        const list = res.data as ProfileChatList;

        this.unacked = list.items.some((chat) => !(chat as APIProfileChat).read);

        const remote = new Set(list.items.map((chat) => (chat as APIProfileChat).message_id));

        await db.transaction('rw', db.chatroom_chats, async () => {
            const unsent = (await db.chatroom_chats
                .where('chatroom')
                .equals(this.chatroom)
                .toArray()
            ).filter((chat) => isUnsent(chat) && !remote.has(chat.id));

            await db.chatroom_chats
                .where('chatroom')
                .equals(this.chatroom)
                .delete();

            await db.chatroom_chats.bulkPut(unsent);

            for (const chat of list.items) {
                const c = chat as APIProfileChat;
                await db.chatroom_chats.put({
                    id: c.message_id,
                    chatroom: this.chatroom,
                    sender: c.sender_callsign,
                    sender_uid: c.sender_uid,
                    message: c.message,
                    // Postgres timestamps are not ISO 8601 formatted - normalize
                    // so they sort consistently against locally created messages
                    created: new Date(c.created).toISOString(),
                    status: (c.status as ChatStatus | null) ?? undefined
                });
            }
        });

        const activeItem = list.items[list.items.length - 1];
        if (activeItem) {
            await db.chatroom.update(this.chatroom, {
                updated: (activeItem as APIProfileChat).created
            });
        }
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

        // Oldest to most recent - compare as dates as stored timestamps
        // may be a mix of ISO 8601 and Postgres formatted strings
        chats.sort((a, b) => {
            return new Date(a.created).getTime() - new Date(b.created).getTime();
        });

        return expireSending(chats);
    }

    async markRead(): Promise<void> {
        const room = await db.chatroom.get(this.chatroom);

        if (room?.unread) {
            await db.chatroom.update(this.chatroom, { unread: 0 });
        } else if (!this.unacked) {
            return;
        }

        this.unacked = false;

        const res = await server.POST('/api/profile/chatroom/{:chatroom}/read', {
            params: { path: { ':chatroom': this.chatroom } }
        });

        if (res.error) {
            this.unacked = true;
            console.error('Failed to mark Chats as read', res.error);
        }
    }

    async send(
        message: string,
        sender: { uid: string, callsign: string },
        worker: Remote<Atlas>,
        recipient?: { uid: string, callsign: string }
    ): Promise<void> {
        const chat: DBChatroomChat = {
            id: crypto.randomUUID(),
            chatroom: this.chatroom,
            sender: sender.callsign,
            sender_uid: sender.uid,
            message: message,
            created: new Date().toISOString(),
            status: ChatStatus.Sending
        };

        await db.chatroom.update(this.chatroom, {
            updated: chat.created
        });

        await db.chatroom_chats.put(chat);

        await this.dispatch(chat, sender, worker, recipient);
    }

    /**
     * Resend a message under its original id so recipients that did get it don't see it twice
     */
    async retry(
        id: string,
        sender: { uid: string, callsign: string },
        worker: Remote<Atlas>,
        recipient?: { uid: string, callsign: string }
    ): Promise<void> {
        const chat = await db.chatroom_chats.get(id);
        if (!chat) return;

        chat.status = ChatStatus.Sending;
        chat.created = new Date().toISOString();

        await db.chatroom_chats.put(chat);

        await this.dispatch(chat, sender, worker, recipient);
    }

    private async dispatch(
        chat: DBChatroomChat,
        sender: { uid: string, callsign: string },
        worker: Remote<Atlas>,
        recipient?: { uid: string, callsign: string }
    ): Promise<void> {
        try {
            if (!recipient) {
                const single = (await this.list()).find((c) => {
                    return c.sender_uid !== sender.uid
                });

                if (single) {
                    recipient = {
                        uid: single.sender_uid,
                        callsign: single.sender
                    }
                } else {
                    const contact = await ContactManager.getByCallsign(this.chatroom);

                    recipient = contact
                        ? { uid: contact.uid, callsign: contact.callsign }
                        : { uid: this.chatroom, callsign: this.chatroom };
                }
            }

            const location = (await worker.profile?.location)?.coordinates || [0, 0];

            const sent = await worker.conn.sendCOT({
                chatroom: this.chatroom,
                from: {
                    uid: sender.uid,
                    callsign: sender.callsign
                },
                to: recipient,
                message: chat.message,
                messageId: chat.id,
                time: chat.created,
                location
            }, 'chat');

            if (!sent) throw new Error('Not connected to the CloudTAK Server');
        } catch (err) {
            console.error('Failed to send Chat', err);
            await db.chatroom_chats.where('id').equals(chat.id).modify(failIfSending);
            return;
        }

        setTimeout(() => {
            void db.chatroom_chats.where('id').equals(chat.id).modify(failIfSending);
        }, SEND_TIMEOUT_MS);
    }
}
