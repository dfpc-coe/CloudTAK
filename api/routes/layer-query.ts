import Err from '@openaddresses/batch-error';
import Dynamo from '../lib/aws/dynamo.js';
import Config from '../lib/config.js';
import Cacher from '../lib/cacher.js';
import Auth from '../lib/auth.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { Layer } from '../lib/schema.js';
import Modeler from '@openaddresses/batch-generic';

export default async function router(schema: any, config: Config) {
    const LayerModel = new Modeler(config.pg, Layer);
    const ddb = new Dynamo(config.StackName);

    await schema.get('/layer/:layerid/query', {
        name: 'Get Layer',
        group: 'LayerQuery',
        auth: 'user',
        description: 'Get the latest feature from a layer',
        ':layerid': 'integer',
        query: 'req.query.LayerQuery.json',
        res: 'res.LayerQuery.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(req.params.layerid));
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
        auth: 'user',
        description: 'Get the latest feature from a layer',
        ':layerid': 'integer',
        ':featid': 'string',
        res: 'res.LayerQueryFeature.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await LayerModel.from(parseInt(req.params.layerid));
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
