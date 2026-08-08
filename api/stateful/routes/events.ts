import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { StandardResponse } from '../../common/types.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/event/set', {
        name: 'Set Event Schedule',
        group: 'HubEvent',
        description: 'Create, update or remove (cron: null) the scheduled event for a layer',
        body: Type.Object({
            layerid: Type.Integer(),
            cron: Type.Union([Type.String(), Type.Null()]),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await config.hub.eventSet(req.body.layerid, req.body.cron);

            res.json({ status: 200, message: 'Event Set' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
