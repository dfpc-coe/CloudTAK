import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import { AuthResource } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/profile', {
        name: 'Get Profile',
        auth: 'user',
        group: 'Profile',
        description: 'Get User\'s Profile',
        res: 'res.Profile.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.as_user(config.models, req);
            const profile = await config.models.Profile.from(user.email);

            return res.json(profile);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/profile', {
        name: 'Update Profile',
        auth: 'user',
        group: 'Profile',
        description: 'Update User\'s Profile',
        body: 'req.body.PatchProfile.json',
        res: 'res.Profile.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.as_user(config.models, req);
            const profile = await config.models.Profile.commit(user.email, req.body);

            return res.json(profile);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
