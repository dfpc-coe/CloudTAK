import { Type } from '@sinclair/typebox'
import { randomUUID } from 'node:crypto';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { Channel }  from '../lib/external.js';
import TAKAPI, {
    APIAuthPassword,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/ldap/channel', {
        name: 'List Channel',
        group: 'LDAP',
        description: 'List Channels by proxy',
        query: Type.Object({
            agency: Type.Optional(Type.Integer()),
            filter: Type.String({ default: '' })
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Channel)
        })
    }, async (req, res) => {
        try {
            const profile = await Auth.as_profile(config, req);

            if (!config.server.provider_url || !config.server.provider_secret || !config.server.provider_client) {
                throw new Err(400, null, 'External LDAP API not configured - Contact your administrator');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');

            const list = await config.external.channels(profile.id, req.query)

            res.json(list);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/ldap/user', {
        name: 'Create Machine User',
        group: 'LDAP',
        description: 'Create a machine user',
        body: Type.Object({
            name: Type.String(),
            description: Type.String(),
            agency_id: Type.Union([Type.Integer(), Type.Null()]),
            connection_id: Type.Integer(),
            channels: Type.Array(Type.Integer(), {
                minItems: 1
            })
        }),
        res: Type.Object({
            cert: Type.String(),
            key: Type.String()
        })
    }, async (req, res) => {
        try {
            const profile = await Auth.as_profile(config, req);

            if (!config.server.provider_url || !config.server.provider_secret || !config.server.provider_client) {
                throw new Err(400, null, 'External LDAP API not configured - Contact your administrator');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');

            const password = randomUUID();
            const user = await config.external.createMachineUser(profile.id, {
                ...req.body,
                agency_id: req.body.agency_id || undefined,
                password,
                integration: {
                    name: req.body.name,
                    description: req.body.description,
                    management_url: config.API_URL + `/connection/${req.body.connection_id}`
                }
            });

            for (const channel of req.body.channels) {
                await config.external.attachMachineUser(profile.id, {
                    machine_id: user.id,
                    channel_id: channel
                })
            }

            const api = await TAKAPI.init(
                new URL(config.server.webtak),
                new APIAuthPassword(user.email, password)
            );

            const certs = await api.Credentials.generate();

            res.json(certs)
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
