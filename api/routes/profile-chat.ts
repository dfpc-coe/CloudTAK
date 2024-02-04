import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import Modeler from '@openaddresses/batch-generic';
import { AuthResource } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/profile/chat', {
        name: 'Get Chat',
        auth: 'user',
        group: 'ProfileChats',
        description: 'Get User\'s Profile Chats',
        res: 'res.ListProfileChats.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.is_user(req);
            const chats = await config.models.ProfileChat.chats(user.email);
            return res.json(chats);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
