import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import { AuthResource } from '@tak-ps/blueprint-login';
import { sql } from 'drizzle-orm';

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
            const sub = await config.models.ProfileSubscription.generate({
                ...req.body,
                username: user.email
            });

            // @TODO Subscribe to TAK mission

            return res.json(sub);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/profile/sub/:subid', {
        name: 'Delete Subscription',
        auth: 'user',
        group: 'Profile',
        ':subid': 'integer',
        description: 'delete a mission subscription',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.as_user(config.models, req);

            const sub = await config.models.ProfileSubscription.from(parseInt(String(req.params.subid)));

            if (sub.username !== user.email) {
                throw new Err(403, null, 'Cannot delete anothers subscriptions');
            }

            await config.models.ProfileSubscription.delete(parseInt(String(req.params.subid)));

            // @TODO Unsubscribe if TAK subscription is active

            return res.json({
                status: 200,
                message: 'Subscription Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
