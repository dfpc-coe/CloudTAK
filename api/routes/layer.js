import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';
import { XML as COT } from '@tak-ps/node-cot';

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
        res: 'layers.json'
    }, async (req, res) => {
        try {
            res.json(await Layer.generate(config.pool, req.body));
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
        res: 'layers.json'
    }, async (req, res) => {
        try {
            res.json(await Layer.commit(config.pool, req.params.layerid, req.body));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/layer/:layerid', {
        name: 'Create Layer',
        group: 'Layer',
        auth: 'admin',
        description: 'Register a new layer',
        ':layerid': 'string',
        res: 'layers.json'
    }, async (req, res) => {
        try {
            res.json(await Layer.from(config.pool, req.params.layerid));
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
            console.error(`OBTAINED FEATURE`, req.body.features.length);
            for (const feature of req.body.features) {
                config.tak.write(COT.from_geojson(feature));
            }

            res.json({
                status: 200,
                message: 'Submitted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

}
