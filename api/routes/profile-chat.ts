import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import Modeler from '@openaddresses/batch-generic';

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

            const chats = await config.models.ProfileChat.chats(req.auth.email);

            return res.json(chats);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
