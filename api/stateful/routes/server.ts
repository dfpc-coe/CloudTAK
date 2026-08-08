import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { ConnStatusSchema } from '../../common/hub/index.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/server/refresh', {
        name: 'Refresh Server',
        group: 'HubServer',
        description: 'Reload the TAK Server record from the database and reconnect the admin connection',
        body: Type.Object({
            refreshAll: Type.Optional(Type.Boolean()),
        }),
        res: Type.Object({
            status: ConnStatusSchema,
        }),
    }, async (req, res) => {
        try {
            const status = await config.hub.serverRefresh({
                refreshAll: req.body.refreshAll,
            });

            res.json({ status });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
