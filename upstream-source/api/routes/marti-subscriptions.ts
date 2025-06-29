import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Subscription, ListSubscriptionInput } from '@tak-ps/node-tak/lib/api/subscriptions'
import {
    TAKList,
} from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/subscription', {
        name: 'List Subscriptions',
        group: 'MartiSubscription',
        description: 'Helper API to list subscriptions that the client can see',
        query: ListSubscriptionInput,
        res: TAKList(Subscription)
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const groups: Set<string> = new Set();
            (await api.Group.list({
                useCache: true
            })).data.forEach((group) => {
                groups.add(group.name)
            });

            const subs = await api.Subscription.list(req.query);

            subs.data.forEach((sub) => {
                return sub.groups.filter((group) => {
                    return groups.has(group.name);
                })
            });

            res.json(subs);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/subscription/:clientuid', {
        name: 'Get Subscription',
        group: 'MartiSubscription',
        description: 'Helper API to get a subscription',
        params: Type.Object({
            clientuid: Type.String()
        }),
        res: Subscription
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const subs = await api.Subscription.list({
                sortBy: 'CALLSIGN',
                direction: 'ASCENDING',
                page: -1,
                limit: -1
            });

            const groups: Set<string> = new Set();
            (await api.Group.list({
                useCache: true
            })).data.forEach((group) => {
                groups.add(group.name)
            });

            let done = false;
            for (const sub of subs.data) {
                if (sub.clientUid === req.params.clientuid) {
                    sub.groups = sub.groups.filter((group) => {
                        return groups.has(group.name);
                    });

                    res.json(sub);
                    done = true;
                }
            }

            if (!done) throw new Err(404, null, `Subscription for ${req.params.clientuid} not found`);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
