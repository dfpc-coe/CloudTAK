import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import Auth from '../../common/auth.js';
import type ConfigStateless from '../config.js';

const GeofenceStatusResponse = Type.Object({
    state: Type.String({
        enum: ['disabled', 'disconnected', 'connecting', 'connected', 'reconnecting', 'error', 'closing'],
    }),
    enabled: Type.Boolean(),
    configured: Type.Boolean(),
    connected: Type.Boolean(),
    url: Type.String(),
    reconnectAttempts: Type.Integer(),
    lastError: Type.Optional(Type.String()),
});

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/geofence', {
        name: 'Get Geofence',
        group: 'Geofence',
        description: 'Get Geofence server connection status',
        res: GeofenceStatusResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            res.json(await config.hub.geofenceStatus());
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
