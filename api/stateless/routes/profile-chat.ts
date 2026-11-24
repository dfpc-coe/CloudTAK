import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { ProfileChat } from '../../common/schema.js';
import Err from '@openaddresses/batch-error';
import { StandardResponse } from '../../common/types.js';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import * as Default from '../lib/limits.js';
import { DirectChatReceipt } from '@tak-ps/node-cot';
import { profileUid, profileCallsign } from '../../common/control/takserver.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/profile/chatroom', {
        name: 'Get Chatrooms',
        group: 'ProfileChats',
        description: 'Get User\'s Profile Chats',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                id: Type.String(),
                chatroom: Type.String(),
                updated: Type.String(),
            })),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const chats = await config.models.ProfileChat.chats(user.email);

            res.json({
                total: chats.total,
                items: chats.items.map(c => ({
                    id: c.chatroom,
                    chatroom: c.chatroom,
                    updated: c.created,
                })),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom', {
        name: 'Delete Chatrooms',
        group: 'ProfileChats',
        description: 'Delete User\'s Chats',
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
                await config.models.ProfileChat.delete(sql`
                    username = ${user.email}
                    AND chatroom = ${chatroom}
                `);
            }

            res.json({
                status: 200,
                message: `Deleted Chatrooms`,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom/:chatroom', {
        name: 'Delete Chats',
        group: 'ProfileChats',
        description: 'Delete User\'s Chats',
        params: Type.Object({
            chatroom: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileChat.delete(sql`
                username = ${user.email}
                AND chatroom = ${req.params.chatroom}
            `);

            res.json({
                status: 200,
                message: `Deleted Chatroom`,
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/profile/chatroom/:chatroom/read', {
        name: 'Read Chats',
        group: 'ProfileChats',
        description: 'Mark every message in a chatroom as read and send Read Receipts to their senders',
        params: Type.Object({
            chatroom: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const chats = await config.models.ProfileChat.read(user.email, req.params.chatroom);

            const uid = profileUid(user.email);
            const unacked = chats.filter((chat) => chat.sender_uid !== uid);

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

            res.json({
                status: 200,
                message: `Read ${chats.length} Chats`,
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
