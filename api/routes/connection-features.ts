import { Type, Static } from '@sinclair/typebox'
import tokml from 'tokml';
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import { ConnectionFeature } from '../lib/schema.js';
import { StandardResponse, FeatureResponse, GeoJSONFeatureCollection, GeoJSONFeature } from '../lib/types.js'
import { ExportFeatureFormat } from '../lib/enums.js'
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/feature', {
        name: 'Get Features',
        group: 'ConnectionFeature',
        description: `
            Return a list of Connecton Features
        `,
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        query: Type.Object({
            format: Type.Enum(ExportFeatureFormat, {
                default: ExportFeatureFormat.GEOJSON
            }),
            download: Type.Boolean({
                default: false,
                description: 'Set Content-Disposition to download the file'
            }),
            limit: Type.Integer({ default: 1000 }),
            sort: Type.String({
                default: 'id',
                enum: Object.keys(ConnectionFeature)
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
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const list = await config.models.ConnectionFeature.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    connection = ${req.params.connectionid}
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
                const filename = `connection-${connection.id}-export-${new Date().toISOString()}`;

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

    await schema.delete('/connection/:connectionid/feature', {
        name: 'Delete Feature',
        group: 'ConnectionFeature',
        description: 'Delete multiple features',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        query: Type.Object({
            path: Type.Optional(Type.String()),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (req.query.path) {
                await config.models.ConnectionFeature.delete(sql`
                    starts_with(path, ${req.query.path})
                    AND connection = ${req.params.connectionid}
                `);
            } else {
                await config.models.ConnectionFeature.delete(sql`
                    connection = ${req.params.connectionid}
                `);
            }

            res.json({
                status: 200,
                message: 'Features Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/feature/:id', {
        name: 'Delete Feature',
        group: 'ConnectionFeature',
        description: `
            Delete a feature
        `,
        params: Type.Object({
            connectionid: Type.Integer(),
            id: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            await config.models.ConnectionFeature.delete(sql`
                id = ${req.params.id}
                AND connection = ${req.params.connectionid}
            `);

            res.json({
                status: 200,
                message: 'Feature Deleted'
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/feature/:id', {
        name: 'Get Feature',
        group: 'ConnectionFeature',
        description: `
            Get a feature
        `,
        params: Type.Object({
            connectionid: Type.Integer(),
            id: Type.String()
        }),
        res: FeatureResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const feat = await config.models.ConnectionFeature.from(sql`
                id = ${req.params.id}
                AND connection = ${req.params.connectionid}
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
