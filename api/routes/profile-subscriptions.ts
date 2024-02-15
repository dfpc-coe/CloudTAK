import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';
import { AuthResource } from '@tak-ps/blueprint-login';
import { sql } from 'drizzle-orm';
import TAKAPI, {
    APIAuthToken,
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

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
            const profile = await config.models.Profile.from(user.email);
            const sub = await config.models.ProfileSubscription.generate({
                ...req.body,
                username: user.email
            });

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const mission = await api.Mission.subscribe(req.params.name, {
                uid: user.email
            });

            return res.json(sub);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/profile/sub', {
        name: 'Delete Subscription',
        auth: 'user',
        group: 'Profile',
        description: 'delete a mission subscription',
        query: {
            type: 'object',
            required: ['guid'],
            properties: {
                guid: { type: 'string' }
            }
        },
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            const user = await Auth.as_user(config.models, req);
            const profile = await config.models.Profile.from(user.email);
            const sub = await config.models.ProfileSubscription.from(sql`
                username = ${user.email} AND guid = ${String(req.params.guid)}
            `);

            if (sub.username !== user.email) {
                throw new Err(403, null, 'No subscription with that GUID present');
            }

            await config.models.ProfileSubscription.delete(sql`
                username = ${user.email} AND guid = ${String(req.params.guid)}
            `);

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            // @TODO Unsubscribe if TAK subscription is active
            await api.Mission.unsubscribe(req.params.name, {
                uid: user.email
            });

            return res.json({
                status: 200,
                message: 'Subscription Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
