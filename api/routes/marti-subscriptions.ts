import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Subscription, ListSubscriptionInput } from '../lib/api/subscriptions.js'
import TAKAPI, {
    APIAuthCertificate
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/subscription', {
        name: 'List Subscriptions',
        group: 'MartiSubscription',
        description: 'Helper API to list subscriptions that the client can see',
        query: ListSubscriptionInput,
        res: Type.Object({
            version: Type.String(),
            type: Type.String(),
            data:  Type.Array(Subscription),
            messages: Type.Optional(Type.Array(Type.String())),
            nodeId: Type.Optional(Type.String())
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const groups: Set<string> = new Set();
            (await api.Group.list()).data.forEach((group) => {
                groups.add(group.name)
            });

            const subs = await api.Subscription.list(req.query);

            subs.data.forEach((sub) => {
                return sub.groups.filter((group) => {
                    return groups.has(group.name);
                })
            });

            return res.json(subs);
        } catch (err) {
            return Err.respond(err, res);
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
            (await api.Group.list()).data.forEach((group) => {
                groups.add(group.name)
            });

            for (const sub of subs.data) {
                if (sub.clientUid === req.params.clientuid) {
                    sub.groups = sub.groups.filter((group) => {
                        return groups.has(group.name);
                    });
                    return res.json(sub);
                }
            }

            throw new Err(404, null, `Subscription for ${req.params.clientuid} not found`);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
