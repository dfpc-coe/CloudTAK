import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import * as Default from '../lib/limits.js';

export const AgencyResponse = Type.Object({
    id: Type.Integer(),
    name: Type.String(),
});

export default async function router(schema: Schema, config: Config) {
    await schema.get('/agency', {
        name: 'Get Agencies',
        group: 'Agency',
        description: 'Return a list Agencies',
        query: Type.Object({
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            config: Type.Object({
                enabled: Type.Boolean()
            }),
            items: Type.Array(AgencyResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);

            if (!config.external || !config.external.configured) {
                res.json({
                    total: 0,
                    config: {
                        enabled: false
                    },
                    items: []
                });
            } else if (!profile.id) {
                throw new Err(400, null, 'External ID must be set on profile');
            } else if (config.external)  {
                const list = await config.external.agencies(profile.id, req.query.filter);

                res.json({
                    ...list,
                    config: {
                        enabled: true
                    }
                });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/agency/:agencyid', {
        name: 'Get Agency',
        group: 'Agency',
        description: 'Return a single agency by id',
        params: Type.Object({
            agencyid: Type.Integer()
        }),
        res: AgencyResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);

            if (!config.external || !config.external.configured) {
                throw new Err(404, null, 'External API not configured');
            }

            if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');
            const agency = await config.external.agency(profile.id, req.params.agencyid);

            res.json(agency);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
