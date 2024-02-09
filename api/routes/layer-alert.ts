import Err from '@openaddresses/batch-error';
import Cacher from '../lib/cacher.js';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { LayerAlert } from '../lib/schema.js';
import Config from '../lib/config.js';
import { Param } from '@openaddresses/batch-generic';
import { sql, eq } from 'drizzle-orm';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/layer/:layerid/alert', {
        name: 'List Alerts',
        group: 'Layer Alerts',
        auth: 'user',
        description: 'List layer alerts',
        ':layerid': 'integer',
        query: 'req.query.ListLayerAlerts.json',
        res: 'res.ListLayerAlerts.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: parseInt(req.params.layerid) }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(req.params.layerid))
            });

            const list = await config.models.LayerAlert.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
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

    await schema.post('/layer/:layerid/alert', {
        name: 'Create Alert',
        group: 'Layer Alerts',
        auth: 'user',
        description: 'Create a new layer alert',
        ':layerid': 'integer',
        body: 'req.body.CreateLayerAlert.json',
        res: 'layer_alerts.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: parseInt(req.params.layerid) }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(req.params.layerid))
            });

            req.body.layer = layer.id;
            const alert = config.pg.insert(LayerAlert)
                .values(req.body)
                .onConflictDoUpdate({
                    target: [LayerAlert.layer, LayerAlert.title],
                    set: req.body
                })
                .returning()

            res.json(alert);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/layer/:layerid/alert', {
        name: 'Delete Alerts',
        group: 'Layer Alerts',
        auth: 'user',
        description: 'Delete all alerts for the layer',
        ':layerid': 'integer',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: parseInt(req.params.layerid) }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(req.params.layerid))
            });

            const list = await config.models.LayerAlert.delete(eq(layer.id, LayerAlert.layer))

            res.json({
                status: 200,
                message: 'Alerts Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/layer/:layerid/alert/:alertid', {
        name: 'Delete Alerts',
        group: 'Layer Alerts',
        auth: 'user',
        description: 'Delete all alerts for the layer',
        ':layerid': 'integer',
        ':alertid': 'integer',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: parseInt(req.params.layerid) }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(parseInt(req.params.layerid))
            });

            const alert = await config.models.LayerAlert.from(parseInt(req.params.alertid));
            if (alert.layer !== layer.id) throw new Err(400, null, 'Alert does not belong to this layer');

            await config.models.LayerAlert.delete(parseInt(req.params.alertid));

            res.json({
                status: 200,
                message: 'Alert Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
