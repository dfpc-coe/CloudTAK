import Err from '@openaddresses/batch-error';
import ChatControl from '../control/chat.js';
import type { RoomView, MessageView } from '../control/chat.js';
import type { HubConfig } from '../control/import.js';
import { ChatroomType, ChatMemberRole } from '../enums.js';
import type { ChatMember } from '../types.js';
import { BroadcastChatroom } from './tak.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LegacyChat = {
    id: string;
    username: string;
    chatroom: string;
    sender_callsign: string;
    sender_uid: string;
    message_id: string;
    message: string;
    created: string;
    updated: string;
    status: string | null;
};

export type LegacySend = {
    chatroom: string;
    to?: ChatMember;
    message: string;
    messageId?: string;
    location?: Array<number>;
};

/**
 * The chat API of CloudTAK <= 14.0 where a Chatroom is identified by the name a user sees it under
 */
export default class LegacyChatControl {
    chat: ChatControl;

    constructor(config: HubConfig) {
        this.chat = new ChatControl(config);
    }

    private async named(username: string, name: string): Promise<Array<RoomView>> {
        return (await this.chat.views(username)).filter((room) => room.name === name);
    }

    async rooms(username: string): Promise<Array<{ chatroom: string; updated: string }>> {
        const rooms = new Map<string, string>();

        for (const room of await this.chat.views(username)) {
            if (!rooms.has(room.name)) rooms.set(room.name, room.updated);
        }

        return [...rooms.entries()].map(([chatroom, updated]) => ({ chatroom, updated }));
    }

    async messages(username: string, name: string, limit: number): Promise<{ total: number; items: Array<LegacyChat> }> {
        const items: Array<MessageView> = [];
        let total = 0;

        for (const room of await this.named(username, name)) {
            const list = await this.chat.messages(username, room.id, { limit });
            total += list.total;
            items.push(...list.items);
        }

        return {
            total,
            items: items
                .filter((message) => !message.deleted)
                .sort((a, b) => b.created.localeCompare(a.created))
                .slice(0, limit)
                .map((message) => ({
                    id: message.id,
                    username,
                    chatroom: name,
                    sender_callsign: message.sender_callsign,
                    sender_uid: message.sender_uid,
                    message_id: message.id,
                    message: message.body,
                    created: message.created,
                    updated: message.updated,
                    status: message.status,
                })),
        };
    }

    /** Clear Chatrooms for the user - a Group they own is left alone as leaving it deletes it for everyone */
    async leave(username: string, names: Array<string>): Promise<void> {
        for (const name of names) {
            for (const room of await this.named(username, name)) {
                if (room.type === ChatroomType.GROUP && room.role === ChatMemberRole.OWNER) continue;

                await this.chat.leave(username, room.id);
            }
        }
    }

    /** Only Messages the user sent can be deleted, anything else is left as it was */
    async remove(username: string, name: string, ids: Array<string>): Promise<void> {
        const uid = (await this.chat.identity(username)).uid;

        for (const room of await this.named(username, name)) {
            const messages = await this.chat.messageViews(ids.filter((id) => UUID.test(id)));

            for (const message of messages) {
                if (message.chatroom !== room.id || message.sender_uid !== uid || message.deleted) continue;

                await this.chat.remove(username, room.id, message.id);
            }
        }
    }

    async send(username: string, input: LegacySend): Promise<MessageView> {
        const me = await this.chat.identity(username);
        const to = input.to;

        let id: string | undefined;

        if (input.chatroom === BroadcastChatroom || to?.uid === BroadcastChatroom) {
            id = (await this.chat.broadcast(me)).id;
        } else {
            const rooms = await this.named(username, input.chatroom);

            if (to) id = rooms.find((room) => room.members.some((member) => member.uid === to.uid))?.id;

            // Without a known contact the recipient is a guess made from the name of the Chatroom
            if (!id && (!to || to.uid === input.chatroom)) id = rooms[0]?.id;
        }

        if (!id) {
            if (!to?.uid) throw new Err(400, null, 'Chat recipient is required');

            id = (await this.chat.direct(me, { uid: to.uid, callsign: to.callsign || to.uid })).id;
        }

        const location = input.location;

        return await this.chat.send(username, id, {
            id: input.messageId && UUID.test(input.messageId) ? input.messageId : undefined,
            body: input.message,
            metadata: location && location.length >= 2 && (location[0] !== 0 || location[1] !== 0)
                ? { location: [location[0], location[1]] }
                : undefined,
        });
    }
}
