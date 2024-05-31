import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Dynamo from '../lib/aws/dynamo.js';
import Config from '../lib/config.js';
import Cacher from '../lib/cacher.js';
import Auth, { AuthResourceAccess }  from '../lib/auth.js';

export default async function router(schema: Schema, config: Config) {
    const ddb = new Dynamo(config.StackName);

    await schema.get('/connection/:connectionid/layer/:layerid/query', {
        name: 'Get Layer',
        group: 'LayerQuery',
        description: 'Get the latest feature from a layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            filter: Type.Optional(Type.String({ "description": "Filter by Id prefix" }))
        }),
        res: Type.Object({
            type: Type.String(),
            features: Type.Array(Type.Any())
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

            if (!layer.logging) throw new Err(400, null, 'Feature Logging has been disabled for this layer');

            const features = (await ddb.query(layer.id, req.query)).map((feat) => {
                return {
                    id: feat.Id,
                    type: 'Feature',
                    properties: feat.Properties,
                    geometry: feat.Geometry
                }
            });

            return res.json({
                type: 'FeatureCollection',
                features
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/layer/:layerid/query/:featid', {
        name: 'Get Layer',
        group: 'LayerQuery',
        description: 'Get the latest feature from a layer',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            layerid: Type.Integer({ minimum: 1 }),
            featid: Type.String()
        }),
        res: Type.Object({
            id: Type.String(),
            type: Type.String(),
            properties: Type.Any(),
            geometry: Type.Any()
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

            if (!layer.logging) throw new Err(400, null, 'Feature Logging has been disabled for this layer');

            const feat = await ddb.row(layer.id, req.params.featid);

            return res.json({
                id: feat.Id,
                type: 'Feature',
                properties: feat.Properties,
                geometry: feat.Geometry
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
