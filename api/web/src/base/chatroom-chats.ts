import { db } from './database.ts';
import { std, stdurl } from '../std.ts';
import type {
    ProfileChatList,
    APIProfileChat
} from '../types.ts'
import type { DBChatroomChat } from './database.ts';
import type Atlas from '../workers/atlas.ts';

export default class ChatroomChats {
    chatroom: string;

    constructor(
        chatroom: string
    ) {
        this.chatroom = chatroom;
    }

    async refresh(): Promise<void> {
        const url = stdurl(`/api/profile/chatroom/${encodeURIComponent(this.chatroom)}/chat`);

        const list = await std(url) as ProfileChatList;

        await db.transaction('rw', db.chatroom_chats, async () => {
            await db.chatroom_chats
                .where('chatroom')
                .equals(this.chatroom)
                .delete();

            for (const chat of list.items) {
                const c = chat as APIProfileChat;
                await db.chatroom_chats.put({
                    id: c.message_id,
                    chatroom: this.chatroom,
                    sender: c.sender_callsign,
                    sender_uid: c.sender_uid,
                    message: c.message,
                    created: c.created
                });
            }
        });
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
            return a.created.localeCompare(b.created);
        });

        return chats;
    }

    async send(
        message: string,
        sender: { uid: string, callsign: string },
        worker: Atlas,
        recipient?: { uid: string, callsign: string }
    ): Promise<void> {
        const id = crypto.randomUUID();
        const created = new Date().toISOString();

        await db.chatroom_chats.put({
            id: id,
            chatroom: this.chatroom,
            sender: sender.callsign,
            sender_uid: sender.uid,
            message: message,
            created: created
        });

        if (!recipient) {
            const chats = await this.list();
            const single = chats.find((chat) => {
                return chat.sender_uid !== sender.uid
            });

            if (single) {
                recipient = {
                    uid: single.sender_uid,
                    callsign: single.sender
                }
            } else {
                const contact = await worker.team.getByCallsign(this.chatroom);
                if (contact) {
                    recipient = {
                        uid: contact.uid,
                        callsign: contact.callsign
                    }
                } else {
                    recipient = {
                        uid: this.chatroom,
                        callsign: this.chatroom
                    }
                }
            }
        }

        if (!recipient) throw new Error('Error sending Chat - Contact is not defined');

        await worker.conn.sendCOT({
            chatroom: this.chatroom,
            from: {
                uid: sender.uid,
                callsign: sender.callsign
            },
            to: recipient,
            message: message,
            messageId: id,
            time: created
        }, 'chat');
    }
}
