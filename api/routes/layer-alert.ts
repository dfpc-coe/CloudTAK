import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';
import LayerAlert from '../lib/types/layer-alert.js';
import Cacher from '../lib/cacher.js';
import { sql } from 'slonik';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import Config from '../lib/config.js';

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
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return (await Layer.from(config.pool, req.params.layerid)).serialize();
            });

            const list = await LayerAlert.list(config.pool, layer.id, req.query);

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
            await Auth.is_layer(req, parseInt(req.params.layerid));

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return (await Layer.from(config.pool, req.params.layerid)).serialize();
            });

            const list = await LayerAlert.generate(config.pool, {
                ...req.body,
                layer: layer.id
            });

            res.json(list);
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
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return (await Layer.from(config.pool, req.params.layerid)).serialize();
            });

            const list = await LayerAlert.delete(config.pool, layer.id, {
                column: 'layer'
            });

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
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return (await Layer.from(config.pool, req.params.layerid)).serialize();
            });

            const alert = await LayerAlert.from(config.pool, req.params.alertid);

            if (alert.layer !== layer.id) throw new Err(400, null, 'Alert does not belong to this layer');

            await alert.delete();

            res.json({
                status: 200,
                message: 'Alert Removed'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
