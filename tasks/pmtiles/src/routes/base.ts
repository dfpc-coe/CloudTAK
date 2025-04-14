import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'

export default async function router(schema: Schema) {
    schema.get('/tiles', {
        name: 'API Info',
        group: 'Root',
        description: 'Return API Info for the Tiles API',
        res: Type.Object({
            name: Type.String()
        })
    }, (req, res) => {
        res.json({
           name: process.env.StackName || 'Default Tiles API'
        });
    });
}
