import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileInterest } from '../lib/schema.js';
import { ProfileInterestResponse } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/interest', {
        name: 'Get Interests',
        group: 'ProfileInterests',
        description: `
            Return a list of Profile AOIs
        `,
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({ default: 'name', enum: Object.keys(ProfileInterest) })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileInterestResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const interests = await config.models.ProfileInterest.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    username = ${user.email}
                `
            });

            res.json(interests);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
