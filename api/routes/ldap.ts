import { Type } from '@sinclair/typebox'
import crypto from 'node:crypto';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ConnectionAuth } from '../lib/connection-config.js';
import { Channel, ChannelAccess } from '../lib/external.js';
import { TAKAPI, APIAuthPassword, } from '@tak-ps/node-tak';

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

            if (!config.external || !config.external.configured) {
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
            channels: Type.Array(Type.Object({
                id: Type.Integer(),
                access: ChannelAccess
            }), {
                minItems: 1
            })
        }),
        res: Type.Object({
            integrationId: Type.Optional(Type.Integer()),
            auth: ConnectionAuth
        })
    }, async (req, res) => {
        try {
            const profile = await Auth.as_profile(config, req);

            if (!config.external || !config.external.configured) {
                throw new Err(400, null, 'External LDAP API not configured - Contact your administrator');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');

            const password = Array.from(crypto.randomFillSync(new Uint8Array(16)))
                .map((n) => String.fromCharCode((n % 94) + 33))
                .join('');

            const user = await config.external.createMachineUser(profile.id, {
                ...req.body,
                agency_id: req.body.agency_id || undefined,
                password,
                integration: {
                    name: req.body.name,
                    description: req.body.description,
                    management_url: config.API_URL,
                    active: false,
                }
            });

            for (const channel of req.body.channels) {
                await config.external.attachMachineUser(profile.id, {
                    machine_id: user.id,
                    channel_id: channel.id,
                    access: channel.access
                })
            }

            const api = await TAKAPI.init(
                new URL(config.server.webtak),
                new APIAuthPassword(user.email, password)
            );

            const certs = await api.Credentials.generate();

            res.json({
                integrationId: user.integrations.find(Boolean)?.id ?? undefined,
                auth: certs
            })
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/ldap/user/:email', {
        name: 'Reset Machine User',
        group: 'LDAP',
        description: 'Reset the password on an existing user and regen a certificate',
        params: Type.Object({
            email: Type.String()
        }),
        res: Type.Object({
            integrationId: Type.Optional(Type.Integer()),
            auth: ConnectionAuth
        })
    }, async (req, res) => {
        try {
            const profile = await Auth.as_profile(config, req);

            if (!config.external || !config.external.configured) {
                throw new Err(400, null, 'External LDAP API not configured - Contact your administrator');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');

            const password = Array.from(crypto.randomFillSync(new Uint8Array(16)))
                .map((n) => String.fromCharCode((n % 94) + 33))
                .join('');

            const user = await config.external.fetchMachineUser(profile.id, req.params.email)

            await config.external.updateMachineUser(profile.id, user.id, { password });

            const api = await TAKAPI.init(
                new URL(config.server.webtak),
                new APIAuthPassword(user.email, password)
            );

            const certs = await api.Credentials.generate();

            res.json({
                integrationId: user.integrations.find(Boolean)?.id ?? undefined,
                auth: certs
            })
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
