import { Type } from '@sinclair/typebox'
import { GenericListOrder } from '@openaddresses/batch-generic';
import { validate } from '@maplibre/maplibre-gl-style-spec';
import path from 'node:path';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import S3 from '../lib/aws/s3.js';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { StandardResponse, ProfileFeatureResponse } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import TAKAPI, {
    APIAuthCertificate,
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/feature', {
        name: 'Get Features',
        group: 'ProfileFeature',
        description: `
            Return a list of Profile Features
        `,
        query: Type.Object({
            limit: Type.Integer({ default: 100 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileFeatureResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const list = await config.models.ProfileFeature.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                where: sql`
                    username = ${user.email}
                `
            });

            return res.json(list)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
