import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'

export default async function router(schema: Schema) {
    schema.post('/task', {
        name: 'Create Task',
        group: 'Tasking',
        description: 'Create a new Task Processor',
        query: Type.Object({
            token: Type.String()
        }),
        res: Type.Unknown(),
    }, async (req, res) => {
        try {
            throw new Err(400, null, 'Not Configured');
        } catch (err) {
            Err.respond(err, res);
        }
    })
}
