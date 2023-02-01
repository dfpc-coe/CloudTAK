import Err from '@openaddresses/batch-error';
import Dynamo from '../lib/aws/dynamo.js';

export default async function router(schema, config) {
    const ddb = new Dynamo(config.StackName);

    await schema.get('/layer/:layerid/log', {
        name: 'Get Layer',
        group: 'LayerQuery',
        auth: 'user',
        description: 'Get the latest feature from a layer',
        ':layerid': 'integer',
        //res: 'res.Layer.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            return res.json({
                type: 'FeatureCollection',
                features: []
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
