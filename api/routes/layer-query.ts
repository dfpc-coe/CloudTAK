import Err from '@openaddresses/batch-error';
import Dynamo from '../lib/aws/dynamo.js';
import Config from '../lib/config.js';
import Cacher from '../lib/cacher.js';
import Auth from '../lib/auth.js';
// @ts-ignore
import Layer from '../lib/types/layer.js';
// @ts-ignore
import LayerLive from '../lib/types/layers_live.js';
// @ts-ignore
import LayerFile from '../lib/types/layers_file.js';
import { Request, Response } from 'express';

export default async function router(schema: any, config: Config) {
    const ddb = new Dynamo(config.StackName);

    await schema.get('/layer/:layerid/query', {
        name: 'Get Layer',
        group: 'LayerQuery',
        auth: 'user',
        description: 'Get the latest feature from a layer',
        ':layerid': 'integer',
        query: 'req.query.LayerQuery.json',
        res: 'res.LayerQuery.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            if (!layer.logging) throw new Err(400, null, 'Feature Logging has been disabled for this layer');

            const features = (await ddb.query(layer.id)).map((feat) => {
                return {
                    id: feat.Id,
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
}
