import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { StandardResponse } from '../../common/types.js';
import LegacyChatControl from '../../common/chat/legacy.js';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import * as Default from '../lib/limits.js';

/**
 * Chat routes of CloudTAK <= 14.0, served from Chatrooms for clients that have not updated
 */
export default async function router(schema: Schema, config: ConfigStateless) {
    const legacy = new LegacyChatControl(config);

    await schema.get('/profile/chatroom', {
        name: 'Get Chatrooms',
        group: 'ProfileChats',
        description: 'Deprecated: use GET /chatroom',
        deprecated: true,
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
            const rooms = await legacy.rooms(user.email);

            res.json({
                total: rooms.length,
                items: rooms.map((room) => ({
                    id: room.chatroom,
                    chatroom: room.chatroom,
                    updated: room.updated,
                })),
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom', {
        name: 'Delete Chatrooms',
        group: 'ProfileChats',
        description: 'Deprecated: use DELETE /chatroom/:chatroom',
        deprecated: true,
        query: Type.Object({
            chatroom: Type.Union([Type.String(), Type.Array(Type.String())]),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await legacy.leave(user.email, typeof req.query.chatroom === 'string' ? [req.query.chatroom] : req.query.chatroom);

            res.json({
                status: 200,
                message: 'Deleted Chatrooms',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom/:chatroom', {
        name: 'Delete Chatroom',
        group: 'ProfileChats',
        description: 'Deprecated: use DELETE /chatroom/:chatroom',
        deprecated: true,
        params: Type.Object({
            chatroom: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await legacy.leave(user.email, [req.params.chatroom]);

            res.json({
                status: 200,
                message: 'Deleted Chatroom',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/profile/chatroom/:chatroom/chat', {
        name: 'Get Chats',
        group: 'ProfileChats',
        description: 'Deprecated: use GET /chatroom/:chatroom/message',
        deprecated: true,
        params: Type.Object({
            chatroom: Type.String(),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String()),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Any()),
        }),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            res.json(await legacy.messages(user.email, req.params.chatroom, req.query.limit));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/profile/chatroom/:chatroom/chat', {
        name: 'Delete Chats',
        group: 'ProfileChats',
        description: 'Deprecated: use DELETE /chatroom/:chatroom/message/:message',
        deprecated: true,
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

            await legacy.remove(user.email, req.params.chatroom, typeof req.query.chat === 'string' ? [req.query.chat] : req.query.chat);

            res.json({
                status: 200,
                message: 'Deleted Chats',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
