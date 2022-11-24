import Err from '@openaddresses/batch-error';
import Layer from '../lib/types/layer.js';

export default async function router(schema, config) {
    await schema.post('/layer/:layer/cot', {
        name: 'Post COT',
        group: 'Layer',
        auth: 'admin',
        description: 'Post CoT data to a given layer',
        ':layer': 'string'
    }, async (req, res) => {
        try {
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
