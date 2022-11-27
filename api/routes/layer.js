import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';

export default async function router(schema, config) {
    await schema.post('/layer/cot', {
        name: 'Post COT',
        group: 'Layer',
        auth: 'admin',
        description: 'Post CoT data to a given layer',
        ':layer': 'string'
    }, async (req, res) => {
        try {
            res.json(true);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer', {
        name: 'List Layers',
        group: 'Layer',
        auth: 'user',
        description: 'List layers',
        ':layer': 'string'
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
        ':layer': 'string'
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
        ':layer': 'string'
    }, async (req, res) => {
        try {
            res.json(await Layer.commit(config.pool, req.params.layerid, req.body));
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid', {
        name: 'Create Layer',
        group: 'Layer',
        auth: 'admin',
        description: 'Register a new layer',
        ':layer': 'string'
    }, async (req, res) => {
        try {
            res.json(await Layer.from(config.pool, req.params.layerid));
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
