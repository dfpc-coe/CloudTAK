import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';

export default async function router(schema: Schema) {
    await schema.get('/swagger', {
        name: 'Get Swagger',
        group: 'Swagger',
        description: 'Return Swagger Doc in JSON',
        res: Type.Any()
    }, async (req, res) => {
        try {
            res.json(schema.docs.base)
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
