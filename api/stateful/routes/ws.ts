import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { PresenceMapSchema } from '../../common/hub/index.js';
import { StandardResponse } from '../../common/types.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/ws/notify', {
        name: 'Notify WebSocket Clients',
        group: 'HubWebSocket',
        description: 'Fan a payload out to all of a user\'s connected WebSocket clients',
        body: Type.Object({
            key: Type.String(),
            payload: Type.Unknown(),
            excludeSession: Type.Optional(Type.String()),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await config.hub.wsNotify(req.body.key, req.body.payload, req.body.excludeSession);

            res.json({ status: 200, message: 'Notified' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/ws/presence', {
        name: 'WebSocket Presence',
        group: 'HubWebSocket',
        description: 'Return active WebSocket session presence for the given user keys',
        body: Type.Object({
            keys: Type.Array(Type.String()),
        }),
        res: PresenceMapSchema,
    }, async (req, res) => {
        try {
            res.json(await config.hub.wsPresence(req.body.keys));
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
