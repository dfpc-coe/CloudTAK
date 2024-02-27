import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Dynamo from '../lib/aws/dynamo.js';
import Config from '../lib/config.js';
import Cacher from '../lib/cacher.js';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';

export default async function router(schema: Schema, config: Config) {
    const ddb = new Dynamo(config.StackName);

    await schema.get('/layer/:layerid/query', {
        name: 'Get Layer',
        group: 'LayerQuery',
        description: 'Get the latest feature from a layer',
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        query: 'req.query.LayerQuery.json',
        res: 'res.LayerQuery.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

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

    await schema.get('/layer/:layerid/query/:featid', {
        name: 'Get Layer',
        group: 'LayerQuery',
        description: 'Get the latest feature from a layer',
        params: Type.Object({
            layerid: Type.Integer(),
            featid: Type.String()
        }),
        res: 'res.LayerQueryFeature.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.LAYER, id: req.params.layerid }]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

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
