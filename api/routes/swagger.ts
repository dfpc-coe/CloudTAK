import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/swagger', {
        name: 'Get Swagger',
        group: 'Swagger',
        description: 'Return Swagger Doc in JSON',
        res: Type.Any()
    }, async (req, res) => {
        try {
            return res.json(schema.docs.base)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
