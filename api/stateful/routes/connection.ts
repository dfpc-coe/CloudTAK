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

    await schema.post('/profile/sync', {
        name: 'Sync Profile Connection',
        group: 'HubConnection',
        description: 'Drop a pooled profile connection so it is rebuilt from the profile\'s current certificate',
        body: Type.Object({
            username: Type.String(),
        }),
        res: Type.Object({
            status: Type.Literal(200),
            message: Type.String(),
        }),
    }, async (req, res) => {
        try {
            await config.hub.profileSync(req.body.username);

            res.json({ status: 200, message: 'Profile Connection Synced' });
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

    await schema.post('/connection/channels', {
        name: 'Connection Channels',
        group: 'HubConnection',
        description: 'Return the active channel bitpos set cached on a pooled connection, or null when the connection is not pooled',
        body: Type.Object({
            id: Type.Union([Type.Integer(), Type.String()]),
        }),
        res: Type.Object({
            channels: Type.Union([Type.Array(Type.Integer()), Type.Null()]),
        }),
    }, async (req, res) => {
        try {
            res.json({ channels: await config.hub.connectionChannels(req.body.id) });
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
