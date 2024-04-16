import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic'
import Schema from '@openaddresses/batch-schema';
import { ProfileChat } from '../lib/schema.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';

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
            return res.json(chats);
        } catch (err) {
            return Err.respond(err, res);
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
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({ default: 'created', enum: Object.keys(ProfileChat) })),
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
            return res.json(chats);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
