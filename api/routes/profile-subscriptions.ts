import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import { AuthResource } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/profile/sub', {
        name: 'Get Subscriptions',
        auth: 'user',
        group: 'ProfileSubscription',
        description: 'Get User\'s Subscriptions',
        res: 'res.ListProfileSubscriptions.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.as_user(config.models, req);

            const list = await config.models.ProfileSubscription.list({
                where: sql`
                    username = ${user.email}
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/profile/sub', {
        name: 'Create Subscription',
        auth: 'user',
        group: 'Profile',
        description: 'Create a new mission subscription',
        body: 'req.body.CreateProfileSubscription.json',
        res: 'res.ProfileSubscription.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.as_user(config.models, req);
            const sub = await config.models.ProfileSubscription.commit({
                ...req.body,
                username: user.email
            });

            return res.json(sub);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
