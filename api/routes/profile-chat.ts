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
            await Auth.is_auth(req);

            if (req.auth instanceof AuthResource) throw new Err(400, null, 'Chats can only be listed by an authenticated user');
            const chats = await config.models.ProfileChat.chats(req.auth.email);

            return res.json(chats);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
