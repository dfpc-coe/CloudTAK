import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from '../../common/types.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/core/event/:eventid', {
        name: 'Submit Core Event',
        group: 'HubCoreEvent',
        description: 'Submit a Core Event to the TAK Server immediately rather than waiting for the next scheduled submit cycle',
        params: Type.Object({
            eventid: Type.String({
                format: 'uuid',
            }),
        }),
        body: Type.Object({}),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await config.hub.coreEventSubmit(req.params.eventid);

            res.json({ status: 200, message: 'Core Event Submitted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
