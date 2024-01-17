import Err from '@openaddresses/batch-error';
import { Profile } from '../lib/schema.ts';
import Auth from '../lib/auth.ts';

import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.ts';
import Modeler from '@openaddresses/batch-generic';

export default async function router(schema: any, config: Config) {
    const ProfileModel = new Modeler(config.pg, Profile);

    await schema.get('/profile', {
        name: 'Get Profile',
        auth: 'user',
        group: 'Profile',
        description: 'Get User\'s Profile',
        res: 'res.Profile.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const profile = await ProfileModel.from(req.auth.email);

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
            await Auth.is_auth(req);

            const profile = await ProfileModel.commit(req.auth.email, req.body);

            return res.json(profile);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
