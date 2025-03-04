import { Type, Static } from '@sinclair/typebox'
import { CoT } from '@tak-ps/node-tak';
import { coordEach } from '@turf/meta';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { StandardResponse, ProfileFeature } from '../lib/types.js'
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile/feature', {
        name: 'Get Features',
        group: 'ProfileFeature',
        description: `
            Return a list of Profile Features
        `,
        query: Type.Object({
            limit: Type.Integer({ default: 1000 }),
            page: Default.Page,
            order: Default.Order
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ProfileFeature)
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

            res.json({
                total: list.total,
                items: list.items.map((feat) => {
                    // @ts-expect-error Legacy features
                    feat.properties.archived = true;

                    return {
                        id: feat.id,
                        path: feat.path,
                        type: 'Feature',
                        properties: feat.properties,
                        geometry: feat.geometry
                    } as Static<typeof ProfileFeature>
                })
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/feature', {
        name: 'Delete Feature',
        group: 'ProfileFeature',
        description: `
            Delete features by path
        `,
        query: Type.Object({
            path: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await config.models.ProfileFeature.delete(sql`
                starts_with(path, ${req.query.path}) AND username = ${user.email}
            `);

            res.json({
                status: 200,
                message: 'Features Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.put('/profile/feature', {
        name: 'Upsert Feature',
        group: 'ProfileFeature',
        description: `
            Create or modify a feature
        `,
        query: Type.Object({
            broadcast: Type.Boolean({
                default: false,
                description: `
                    Broadcast featues as CoTs to connected WebSocket clients
                    Used primarily by the Events Task for importing DataPackage CoTs
                `
            })
        }),
        body: ProfileFeature,
        res: ProfileFeature,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            coordEach(req.body.geometry, (coords) => {
                if (coords.length === 2) coords.push(0);
                return coords
            })

            // Saving to database implies archived
            req.body.properties.archived = true;

            const feat: Static<typeof ProfileFeature> = {
                type: 'Feature',
                ...(await config.models.ProfileFeature.generate({
                    id: req.body.id,
                    path: req.body.path,
                    username: user.email,
                    properties: req.body.properties,
                    geometry: req.body.geometry
                }, {
                    upsert: GenerateUpsert.UPDATE
                }))
            } as Static<typeof ProfileFeature>;

            if (req.query.broadcast) {
                const sockets = config.wsClients.get(user.email) || []
                for (const socket of sockets) {
                    if (!socket.client) continue;
                    config.conns.cots(socket.client.config, [CoT.from_geojson(feat)])
                }
            }

            res.json(feat)
        } catch (err) {
             Err.respond(err, res);
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

            res.json({
                status: 200,
                message: 'Feature Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/profile/feature/:id', {
        name: 'Get Feature',
        group: 'ProfileFeature',
        description: `
            Delete a feature
        `,
        params: Type.Object({
            id: Type.String()
        }),
        res: ProfileFeature
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const feat = await config.models.ProfileFeature.from(sql`
                id = ${req.params.id} AND username = ${user.email}
            `);

            // @ts-expect-error Legacy features
            feat.properties.archived = true;

            res.json({
                type: 'Feature',
                ...feat
            } as Static<typeof ProfileFeature>)
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
