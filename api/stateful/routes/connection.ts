import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { ConnStatusSchema, PoolSummarySchema } from '../../common/hub/index.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/connection/sync', {
        name: 'Sync Connection',
        group: 'HubConnection',
        description: 'Add, refresh or remove a connection in the pool from its current database state',
        body: Type.Object({
            id: Type.Integer(),
            force: Type.Optional(Type.Boolean()),
            deleted: Type.Optional(Type.Boolean()),
        }),
        res: Type.Object({
            status: ConnStatusSchema,
        }),
    }, async (req, res) => {
        try {
            const status = await config.hub.connectionSync(req.body.id, {
                force: req.body.force,
                deleted: req.body.deleted,
            });

            res.json({ status });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/status', {
        name: 'Connection Status',
        group: 'HubConnection',
        description: 'Return the pool status of the given connections',
        body: Type.Object({
            ids: Type.Array(Type.Union([Type.Integer(), Type.String()])),
        }),
        res: Type.Record(Type.String(), ConnStatusSchema),
    }, async (req, res) => {
        try {
            res.json(await config.hub.connectionStatus(req.body.ids));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/summary', {
        name: 'Connection Summary',
        group: 'HubConnection',
        description: 'Return pool-wide connection status counts',
        body: Type.Object({}),
        res: PoolSummarySchema,
    }, async (req, res) => {
        try {
            res.json(await config.hub.connectionSummary());
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
