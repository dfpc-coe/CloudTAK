import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { ProfileChat } from '../lib/schema.js';
import Err from '@openaddresses/batch-error';
import { StandardResponse }from '../lib/types.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/chatroom', {
        name: 'Get Chatrooms',
        group: 'ProfileChats',
        description: 'Get User\'s Profile Chats',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                id: Type.String(),
                chatroom: Type.String(),
            }))
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const chats = await config.models.ProfileChat.chats(user.email);

            res.json({
                total: chats.total,
                items: chats.items.map((c) => ({
                    id: c.chatroom,
                    chatroom: c.chatroom
                }))
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
            chatroom: Type.Union([Type.String(), Type.Array(Type.String())])
        }),
        res: StandardResponse
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
                message: `Deleted Chatrooms`
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
            chatroom: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileChat.delete(sql`
                username = ${user.email}
                AND chatroom = ${req.params.chatroom}
            `);

            res.json({
                status: 200,
                message: `Deleted Chatroom`
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
            chatroom: Type.String()
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(ProfileChat)
            }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Any())
        })
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
                `
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
            chatroom: Type.String()
        }),
        query: Type.Object({
            chat: Type.Union([Type.String(), Type.Array(Type.String())])
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (typeof req.query.chat === 'string') {
                req.query.chat = [req.query.chat];
            }

            for (const chat of req.query.chat) {
                await config.models.ProfileChat.delete(sql`
                    username = ${user.email}
                    AND id = ${chat}
                `);
            }

            res.json({
                status: 200,
                message: `Deleted Chats`
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
