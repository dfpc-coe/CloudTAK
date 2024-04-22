import { Type } from '@sinclair/typebox'
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
            filter: Type.String({ default: '' })
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(AgencyResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_auth(config, req);

            if (!config.server.provider_url || !config.server.provider_secret || !config.server.provider_client) {
                return res.json({ total: 0, items: [] })
            }

            const list = await config.external.agencies(req.query.filter);

            console.error(list);

            return res.json({
                total: list.items.length, // This is a lie as there isn't a total in the API
                items: list.items
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
