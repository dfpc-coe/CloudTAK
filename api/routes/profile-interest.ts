import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import type { BBox } from 'geojson';
import { bboxPolygon } from '@turf/bbox-polygon';
import { ProfileInterest } from '../lib/schema.js';
import { ProfileInterestResponse, StandardResponse } from '../lib/types.js'
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
            sort: Type.String({
                default: 'name',
                enum: Object.keys(ProfileInterest)
            }),
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

    await schema.post('/profile/interest', {
        name: 'Create Interest',
        group: 'ProfileInterests',
        description: `
            Create a new Profile AOI
        `,
        body: Type.Object({
            name: Type.String(),
            bounds: Type.Array(Type.Number(), { minItems: 4, maxItems: 4 }),
        }),
        res: ProfileInterestResponse

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const interest = await config.models.ProfileInterest.generate({
                name: req.body.name,
                bounds: bboxPolygon(req.body.bounds as BBox).geometry,
                username: user.email
            });

            res.json(interest);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/profile/interest/:interestid', {
        name: 'Update Interest',
        group: 'ProfileInterests',
        description: `
            Create a new Profile AOI
        `,
        params: Type.Object({
            interestid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            bounds: Type.Optional(Type.Array(Type.Number(), { minItems: 4, maxItems: 4 })),
        }),
        res: ProfileInterestResponse

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            let interest = await config.models.ProfileInterest.from(req.params.interestid);

            if (interest.username !== user.email) {
                throw new Err(400, null, 'You did not create this interest area');
            }

            interest = await config.models.ProfileInterest.commit(req.params.interestid, {
                ...req.body
            });

            res.json(interest);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/interest/:interestid', {
        name: 'Delete Interest',
        group: 'ProfileInterests',
        description: `
            Delete a Profile AOI
        `,
        params: Type.Object({
            interestid: Type.Integer()
        }),
        res: StandardResponse

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const interest = await config.models.ProfileInterest.from(req.params.interestid);

            if (interest.username !== user.email) {
                throw new Err(400, null, 'You did not create this interest area');
            }

            await config.models.ProfileInterest.delete(req.params.interestid);

            res.json({
                status: 200,
                message: 'Interest Area Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
