import { Type, Static } from '@sinclair/typebox'
import { CoTParser } from '@tak-ps/node-cot';
import tokml from 'tokml';
import { coordEach } from '@turf/meta';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileFeature } from '../lib/schema.js';
import { StandardResponse, FeatureResponse, GeoJSONFeatureCollection, GeoJSONFeature } from '../lib/types.js'
import { ExportFeatureFormat } from '../lib/enums.js'
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
            format: Type.Enum(ExportFeatureFormat, {
                default: ExportFeatureFormat.GEOJSON
            }),
            deleted: Type.Boolean({
                default: false,
                description: 'Return Deleted Features'
            }),
            download: Type.Boolean({
                default: false,
                description: 'Set Content-Disposition to download the file'
            }),
            token: Type.Optional(Type.String()),
            limit: Type.Integer({ default: 1000 }),
            sort: Type.String({
                default: 'id',
                enum: Object.keys(ProfileFeature)
            }),
            page: Default.Page,
            order: Default.Order
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(FeatureResponse)
        })

    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { token: true });

            const list = await config.models.ProfileFeature.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    username = ${user.email}
                    AND deleted = ${req.query.deleted}
                `
            });

            if (!req.query.download) {
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
                        } as Static<typeof FeatureResponse>
                    })
                })
            } else {
                const filename = `${user.email}-export-${new Date().toISOString()}`;

                res.setHeader('Content-Disposition', `attachment; filename="${filename}.${req.query.format}"`);

                const feats: Static<typeof GeoJSONFeatureCollection> = {
                    type: 'FeatureCollection',
                    features: list.items.map((feat) => {
                        return {
                            id: feat.id,
                            path: feat.path,
                            type: 'Feature',
                            properties: feat.properties,
                            geometry: feat.geometry
                        } as Static<typeof GeoJSONFeature>
                    })
                }

                if (req.query.format === ExportFeatureFormat.GEOJSON) {
                    res.set('Content-Type', 'application/geo+json');
                    const output = Buffer.from(JSON.stringify(feats, null, 4));

                    res.set('Content-Length', String(Buffer.byteLength(output)));
                    res.write(output);
                    res.end();
                } else if (req.query.format === ExportFeatureFormat.KML) {
                    res.set('Content-Type', 'application/vnd.google-earth.kml+xml');

                    const output = Buffer.from(tokml(feats, {
                        documentName: filename,
                        documentDescription: 'Exported from CloudTAK',
                        simplestyle: true,
                        name: 'callsign',
                        description: 'remarks'
                    }));

                    res.set('Content-Length', String(Buffer.byteLength(output)));
                    res.write(output);
                    res.end();
                } else {
                    throw new Err(400, null, `Unknown Export Format: ${req.query.format}`);
                }
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/profile/feature', {
        name: 'Delete Feature',
        group: 'ProfileFeature',
        description: 'Delete multiple features',
        query: Type.Object({
            path: Type.Optional(Type.String()),
            permanent: Type.Boolean({
                default: false,
                description: 'Permanently delete features instead of archiving them'
            })
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (req.query.permanent) {
                if (req.query.path) {
                    await config.models.ProfileFeature.delete(sql`
                        starts_with(path, ${req.query.path})
                        AND username = ${user.email}
                    `);
                } else {
                    await config.models.ProfileFeature.delete(sql`
                        username = ${user.email}
                    `);
                }
            } else {
                if (req.query.path) {
                    try {
                        await config.models.ProfileFeature.commit(sql`
                            starts_with(path, ${req.query.path})
                            AND username = ${user.email}
                        `, {
                            deleted: true
                        });
                    } catch (err) {
                        // Ignore features not found
                        if (!(err instanceof Error) || !('status' in err) || ('status' in err && err.status !== 404)) {
                            throw err
                        }
                    }
                } else {
                    try {
                        await config.models.ProfileFeature.commit(sql`
                            username = ${user.email}
                        `, {
                            deleted: true
                        });
                    } catch (err) {
                        if (!(err instanceof Error) || !('status' in err) || ('status' in err && err.status !== 404)) {
                            throw err
                        }
                    }
                }
            }

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
        body: FeatureResponse,
        res: FeatureResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            coordEach(req.body.geometry, (coords) => {
                if (coords.length === 2) coords.push(0);
                return coords
            })

            // Saving to database implies archived
            req.body.properties.archived = true;

            const feat: Static<typeof FeatureResponse> = {
                type: 'Feature',
                ...(await config.models.ProfileFeature.generate({
                    id: req.body.id,
                    path: req.body.path,
                    deleted: false, // Putting a feature implies not deleted
                    username: user.email,
                    properties: req.body.properties,
                    geometry: req.body.geometry
                }, {
                    upsert: GenerateUpsert.UPDATE,
                    upsertTarget: [ ProfileFeature.username, ProfileFeature.id ]
                }))
            } as Static<typeof FeatureResponse>;

            if (req.query.broadcast) {
                const sockets = config.wsClients.get(user.email) || []
                for (const socket of sockets) {
                    if (!socket.client) continue;
                    config.conns.cots(socket.client.config, [await CoTParser.from_geojson(feat)])
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
        query: Type.Object({
            permanent: Type.Boolean({
                default: false,
                description: 'Permanently delete features instead of archiving them'
            })
        }),
        params: Type.Object({
            id: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (req.query.permanent) {
                await config.models.ProfileFeature.delete(sql`
                    id = ${req.params.id} AND username = ${user.email}
                `);
            } else {
                await config.models.ProfileFeature.commit(sql`
                    id = ${req.params.id} AND username = ${user.email}
                `, {
                    deleted: true
                });
            }

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
            Get a feature
        `,
        params: Type.Object({
            id: Type.String()
        }),
        res: FeatureResponse
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
            } as Static<typeof FeatureResponse>)
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
