import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';
import LayerLive from '../lib/types/layers_live.js';
import LayerFile from '../lib/types/layers_file.js';
import { XML as COT } from '@tak-ps/node-cot';
import Cacher from '../lib/cacher.js';
import { sql } from 'slonik';

export default async function router(schema, config) {
    await schema.get('/layer', {
        name: 'List Layers',
        group: 'Layer',
        auth: 'user',
        description: 'List layers',
        query: 'req.query.ListLayers.json',
        res: 'res.ListLayers.json'
    }, async (req, res) => {
        try {
            res.json(await Layer.list(config.pool, req.query));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer', {
        name: 'Create Layer',
        group: 'Layer',
        auth: 'admin',
        description: 'Register a new layer',
        body: 'req.body.CreateLayer.json',
        res: 'res.Layer.json'
    }, async (req, res) => {
        try {
            const data = req.body.data;
            delete req.body.data;

            let layer = await Layer.generate(config.pool, req.body);

            if (layer.mode === 'live') {
                await LayerLive.generate(config.pool, {
                    layer_id: layer.id,
                    ...data
                });
            } else if (layer.mode === 'file') {
                await LayerFile.generate(config.pool, {
                    layer_id: layer.id,
                    ...data
                });
            }

            layer = layer.serialize();
            layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/layer/:layerid', {
        name: 'Update Layer',
        group: 'Layer',
        auth: 'admin',
        description: 'Update a layer',
        ':layerid': 'string',
        body: 'req.body.PatchLayer.json',
        res: 'res.Layer.json'
    }, async (req, res) => {
        try {
            const data = req.body.data;
            delete req.body.data;

            let layer = Object.keys(req.body).length > 0
                ?  await Layer.commit(config.pool, req.params.layerid, req.body)
                :  await Layer.from(config.pool, req.params.layerid);

            if (layer.mode === 'live') {
                await LayerLive.commit(config.pool, layer.id, data, {
                    column: 'layer_id'
                });
            } else if (layer.mode === 'file') {
                await LayerFile.commit(config.pool, layer.id, data, {
                    column: 'layer_id'
                });
            }

            layer = layer.serialize();
            layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();

            await config.cacher.del(`layer-${req.params.layerid}`);

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid', {
        name: 'Get Layer',
        group: 'Layer',
        auth: 'user',
        description: 'Get a layer',
        ':layerid': 'string',
        res: 'res.Layer.json'
    }, async (req, res) => {
        try {
            let layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            return res.json(layer);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid/cot', {
        name: 'Post COT',
        group: 'Layer',
        auth: 'admin',
        description: 'Post CoT data to a given layer',
        ':layerid': 'string',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
            let layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                const layer = (await Layer.from(config.pool, req.params.layerid)).serialize();
                layer.data = (layer.mode === 'file' ? await LayerFile.from(config.pool, layer.id, { column: 'layer_id' }) : await LayerLive.from(config.pool, layer.id, { column: 'layer_id' })).serialize();
                return layer;
            });

            const conn = await config.conns.get(layer.connection);

            for (const feature of req.body.features) {
                conn.tak.write(COT.from_geojson(feature));
            }

            await layer.commit({ updated: sql`NOW()` });

            res.json({
                status: 200,
                message: 'Submitted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
