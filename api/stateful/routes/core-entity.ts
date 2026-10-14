import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from '../../common/types.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/core/entity/:entity', {
        name: 'Submit Core Entity',
        group: 'HubCoreEntity',
        description: 'Submit a Core Event or Device to the TAK Server immediately rather than waiting for the next scheduled submit cycle',
        params: Type.Object({
            entity: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({}),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await config.hub.coreEntitySubmit(req.params.entity);

            res.json({ status: 200, message: 'Core Entity Submitted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
