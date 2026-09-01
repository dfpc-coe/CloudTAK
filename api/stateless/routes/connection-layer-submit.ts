import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import LayerMapControl from '../lib/control/LayerMap.js';
import { LayerSubmitResponse } from '../../common/types.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const layerMapControl = new LayerMapControl(config);

    await schema.post('/layer/:layerid/submit', {
        name: 'Submit JSON',
        group: 'Internal',
        description: 'Submit an arbitrary JSON payload to a given layer - mapped to CoreFeatures, CoreEvents or CoreDevices via the Layer\'s configured Maps',
        params: Type.Object({
            layerid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Any(),
        res: LayerSubmitResponse,
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }],
            });

            if (!req.headers['content-type']) throw new Err(400, null, 'Content-Type not set');

            const layer = await config.models.Layer.augmented_from(req.params.layerid);

            if (!layer.connection) throw new Err(400, null, 'Layer is not attached to a Connection');

            const { results, errors } = await layerMapControl.submit(layer, req.body);

            res.status(errors.length ? 400 : 200).json({
                status: errors.length ? 400 : 200,
                message: 'Submitted',
                results,
                errors,
            });
        } catch (err) {
            if (err instanceof Err && err.status === 200) {
                res.json({
                    status: 200,
                    message: err.message,
                    results: [],
                    errors: [],
                });
            } else {
                Err.respond(err, res);
            }
        }
    });
}
