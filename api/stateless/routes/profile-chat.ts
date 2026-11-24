import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { ProfileChat } from '../../common/schema.js';
import Err from '@openaddresses/batch-error';
import { StandardResponse, ChatroomMember } from '../../common/types.js';
import { ProfileChatroomType } from '../../common/enums.js';
import type { ChatroomSummary } from '../../common/models/ProfileChatroom.js';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import * as Default from '../lib/limits.js';
import { DirectChatReceipt } from '@tak-ps/node-cot';
import { profileUid, profileCallsign } from '../../common/control/takserver.js';

const ChatroomResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    type: Type.Enum(ProfileChatroomType),
    parent: Type.Union([Type.Null(), Type.String()]),
    members: Type.Array(ChatroomMember),
    unread: Type.Integer(),
    last_read: Type.Union([Type.Null(), Type.String()]),
    created: Type.String(),
    updated: Type.String(),
});

function chatroomResponse(room: ChatroomSummary): Static<typeof ChatroomResponse> {
    return {
        id: room.id,
        name: room.name,
        type: room.type,
        parent: room.parent,
        members: room.members,
        unread: room.unread,
        last_read: room.last_read,
        created: room.created,
        updated: room.updated,
    };
}

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/profile/chatroom', {
        name: 'Get Chatrooms',
        group: 'ProfileChats',
        description: 'Get User\'s Chatrooms',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ChatroomResponse),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const rooms = await config.models.ProfileChatroom.summaries(user.email);

            res.json({
                total: rooms.length,
                items: rooms.map(chatroomResponse),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom', {
        name: 'Delete Chatrooms',
        group: 'ProfileChats',
        description: 'Delete User\'s Chatrooms and the Chats they contain',
        query: Type.Object({
            chatroom: Type.Union([Type.String(), Type.Array(Type.String())]),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (typeof req.query.chatroom === 'string') {
                req.query.chatroom = [req.query.chatroom];
            }

            for (const chatroom of req.query.chatroom) {
                await config.models.ProfileChatroom.remove(user.email, chatroom);
            }

            res.json({
                status: 200,
                message: `Deleted Chatrooms`,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/profile/chatroom/:chatroom', {
        name: 'Update Chatroom',
        group: 'ProfileChats',
        description: 'Update a Chatroom - advancing last_read marks earlier Chats as read and sends Read Receipts for Direct Chats',
        params: Type.Object({
            chatroom: Type.String(),
        }),
        body: Type.Object({
            last_read: Type.String({
                description: 'message_id of the newest Chat the user has seen',
            }),
        }),
        res: ChatroomResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const room = await config.models.ProfileChatroom.seen(user.email, req.params.chatroom, req.body.last_read);
            const chats = await config.models.ProfileChat.read(user.email, room.id);

            const uid = profileUid(user.email);
            const unacked = room.type === ProfileChatroomType.DIRECT
                ? chats.filter((chat) => chat.sender_uid !== uid)
                : [];

            if (unacked.length) {
                const callsign = await profileCallsign(config, user.email);

                await config.hub.submitCots({
                    connection: user.email,
                    ifPooled: true,
                    cots: unacked.map((chat) => new DirectChatReceipt({
                        to: { uid: chat.sender_uid, callsign: chat.sender_callsign },
                        from: { uid, callsign },
                        status: 'read',
                        messageId: chat.message_id,
                    })),
                });
            }

            const summary = (await config.models.ProfileChatroom.summaries(user.email))
                .find((r) => r.id === room.id);

            res.json(chatroomResponse(summary || { ...room, unread: 0 }));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom/:chatroom', {
        name: 'Delete Chatroom',
        group: 'ProfileChats',
        description: 'Delete a Chatroom and the Chats it contains',
        params: Type.Object({
            chatroom: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileChatroom.remove(user.email, req.params.chatroom);

            res.json({
                status: 200,
                message: `Deleted Chatroom`,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/profile/chatroom/:chatroom/chat', {
        name: 'Get Chats',
        group: 'ProfileChats',
        description: 'Get User\'s Chats',
        params: Type.Object({
            chatroom: Type.String(),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfileChat),
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Any()),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const chats = await config.models.ProfileChat.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    username = ${user.email}
                    AND chatroom = ${req.params.chatroom}
                `,
            });
            res.json(chats);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom/:chatroom/chat', {
        name: 'Delete Chats',
        group: 'ProfileChats',
        description: 'Delete User\'s Chats',
        params: Type.Object({
            chatroom: Type.String(),
        }),
        query: Type.Object({
            chat: Type.Union([Type.String(), Type.Array(Type.String())]),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (typeof req.query.chat === 'string') {
                req.query.chat = [req.query.chat];
            }

            for (const chat of req.query.chat) {
                await config.models.ProfileChat.delete(sql`
                    username = ${user.email}
                    AND message_id = ${chat}
                `);
            }

            res.json({
                status: 200,
                message: `Deleted Chats`,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
