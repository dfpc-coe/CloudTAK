import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { ProfileChat } from '../lib/schema.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/chat', {
        name: 'Get Chatrooms',
        group: 'ProfileChats',
        description: 'Get User\'s Profile Chats',
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Any())
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const chats = await config.models.ProfileChat.chats(user.email);
            res.json(chats);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/chat/:chatroom', {
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
}
