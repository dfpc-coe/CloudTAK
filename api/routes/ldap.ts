import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import * as Default from '../lib/limits.js';

export const ChannelResponse = Type.Object({
    id: Type.Integer(),
    name: Type.String(),
    description: Type.String()
});

export default async function router(schema: Schema, config: Config) {
    await schema.get('/ldap/channel', {
        name: 'List Channel',
        group: 'LDAP',
        description: 'List Channels by proxy',
        res: Type.Object({
            items: Type.Array(ChannelResponse)
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);

            if (!config.server.provider_url || !config.server.provider_secret || !config.server.provider_client) {
                throw new Err(400, null, 'External LDAP API not configured - Contact your administrator');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');

            const list = await config.external.channels(profile.id, req.query.filter)

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/ldap/user', {
        name: 'Create Machine User',
        group: 'LDAP',
        description: 'Create a machine user',
        body: Type.Object({
            channels: Type.Array(Type.String())
        }),
        res: Type.Object({
            cert: Type.String(),
            key: Type.String()
        })
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (!config.server.provider_url || !config.server.provider_secret || !config.server.provider_client) {
                throw new Err(400, null, 'External LDAP API not configured - Contact your administrator');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');
            const list = await config.external.createUser({

            });

            return res.json({
                cert: '',
                key: ''
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
