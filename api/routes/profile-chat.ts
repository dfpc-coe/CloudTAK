import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import Config from '../lib/config.js';
import Modeler from '@openaddresses/batch-generic';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/chat', {
        name: 'Get Chat',
        group: 'ProfileChats',
        description: 'Get User\'s Profile Chats',
        res: Type.Object({
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
}
