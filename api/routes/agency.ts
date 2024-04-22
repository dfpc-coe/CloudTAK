import { Type } from '@sinclair/typebox'
import fetch from '../lib/fetch';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';

export const AgencyResponse = Type.Object({
    id: Type.Integer(),
    name: Type.String()
});

export default async function router(schema: Schema, config: Config) {
    await schema.get('/agency', {
        name: 'Get Agencies',
        group: 'Agency',
        description: 'Return a list Agencies',
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            filter: Type.String({ default: '' })
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(AgencyResponse)
        })

    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            if (!config.server.provider_url || !config.server.provider_secret || !config.server.provider_client) {
                return res.json({ total: 0, items: [] })
            }

        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
