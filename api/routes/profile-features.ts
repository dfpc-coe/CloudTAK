import { Type } from '@sinclair/typebox'
import { Geometry, GeometryCollection } from 'geojson';
import { GenericListOrder, GenerateUpsert } from '@openaddresses/batch-generic';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { StandardResponse, ProfileFeatureResponse } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import { Feature } from '@tak-ps/node-cot';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/feature', {
        name: 'Get Features',
        group: 'ProfileFeature',
        description: `
            Return a list of Profile Features
        `,
        query: Type.Object({
            limit: Type.Integer({ default: 1000 }),
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

            return res.json({
                total: list.total,
                items: list.items.map((feat) => {
                    if (feat.geometry.type === 'GeometryCollection') {
                        throw new Err(500, null, 'GeometryCollection should not be present in ProfileFeature');
                    }

                    const geometry = feat.geometry as Exclude<Geometry, GeometryCollection>

                    return {
                        id: feat.id,
                        type: 'Feature',
                        properties: feat.properties,
                        geometry 
                    }
                })
            })
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.put('/profile/feature', {
        name: 'Upsert Feature',
        group: 'ProfileFeature',
        description: `
            Create or modify a feature
        `,
        body: Feature,
        res: ProfileFeatureResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const feat = await config.models.ProfileFeature.generate({
                id: req.body.id,
                username: user.email,
                properties: req.body.properties,
                geometry: req.body.geometry as Geometry
            }, {
                upsert: GenerateUpsert.UPDATE
            });

            if (feat.geometry.type === 'GeometryCollection') {
                throw new Err(500, null, 'GeometryCollection should not be present in ProfileFeature');
            }

            return res.json({
                id: feat.id,
                type: 'Feature',
                properties: feat.properties,
                geometry: feat.geometry
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/profile/feature/:id', {
        name: 'Delete Feature',
        group: 'ProfileFeature',
        description: `
            Delete a feature
        `,
        params: Type.Object({
            id: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileFeature.delete(sql`
                id = ${req.params.id} AND username = ${user.email}
            `);

            return res.json({
                status: 200,
                message: 'Feature Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
