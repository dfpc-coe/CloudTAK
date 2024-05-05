import { Type } from '@sinclair/typebox'
import { GenericListOrder } from '@openaddresses/batch-generic';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Cacher from '../lib/cacher.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import { LayerAlert } from '../lib/schema.js';
import Config from '../lib/config.js';
import { sql, eq, InferSelectModel } from 'drizzle-orm';
import { StandardResponse, LayerAlertResponse } from '../lib/types.js';

export enum LayerAlertPriority {
    GREEN = 'green',
    YELLOW = 'yellow',
    RED = 'red'
}

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection/:connectionid/layer/:layerid/alert', {
        name: 'List Alerts',
        group: 'Layer Alerts',
        description: 'List layer alerts',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer()
        }),
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(LayerAlert) })),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(LayerAlertResponse)
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            const list = await config.models.LayerAlert.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    title ~* ${req.query.filter}::TEXT
                    AND ${layer.id} = layer
                `
            });

            res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/layer/:layerid/alert', {
        name: 'Create Alert',
        group: 'Layer Alerts',
        description: 'Create a new layer alert',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer()
        }),
        body: Type.Object({
            title: Type.String(),
            description: Type.Optional(Type.String()),
            icon: Type.Optional(Type.String()),
            priority: Type.Optional(Type.Enum(LayerAlertPriority)),
        }),
        res: LayerAlertResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            const alerts = await config.pg.insert(LayerAlert)
                .values({
                    ...req.body,
                    layer: layer.id
                })
                .onConflictDoUpdate({
                    target: [LayerAlert.layer, LayerAlert.title],
                    set: req.body
                })
                .returning();

            if (!alerts.length) throw new Err(500, null, 'Failed to insert alerts');

            res.json(alerts[0] as InferSelectModel<typeof LayerAlert>);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/alert', {
        name: 'Delete Alerts',
        group: 'Layer Alerts',
        description: 'Delete all alerts for the layer',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            await config.models.LayerAlert.delete(eq(layer.id, LayerAlert.layer))

            res.json({
                status: 200,
                message: 'Alerts Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/layer/:layerid/alert/:alertid', {
        name: 'Delete Alerts',
        group: 'Layer Alerts',
        description: 'Delete all alerts for the layer',
        params: Type.Object({
            connectionid: Type.Integer(),
            layerid: Type.Integer(),
            alertid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [
                    { access: AuthResourceAccess.CONNECTION, id: req.params.connectionid },
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            }, req.params.connectionid);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            if (layer.connection !== connection.id) {
                throw new Err(400, null, 'Layer does not belong to this connection');
            }

            const alert = await config.models.LayerAlert.from(req.params.alertid);
            if (alert.layer !== layer.id) throw new Err(400, null, 'Alert does not belong to this layer');

            await config.models.LayerAlert.delete(req.params.alertid);

            res.json({
                status: 200,
                message: 'Alert Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
