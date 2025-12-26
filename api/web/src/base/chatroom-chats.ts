import { db } from './database.ts';
import { std, stdurl } from '../std.ts';
import type {
    ProfileChatList
} from '../types.ts'
import type { DBChatroomChat } from './database.ts';

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
                const c = chat as any;
                await db.chatroom_chats.put({
                    id: c.id,
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
            return new Date(a.created).getTime() - new Date(b.created).getTime();
        });

        return chats;
    }
}
