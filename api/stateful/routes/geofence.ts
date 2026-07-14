import { Type } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { GeofenceStatusSchema } from '../../common/hub/index.js';
import { StandardResponse } from '../../common/types.js';
import type ConfigStateful from '../config.js';

export default async function router(schema: Schema, config: ConfigStateful) {
    await schema.post('/geofence/refresh', {
        name: 'Refresh Geofence',
        group: 'HubGeofence',
        description: 'Reconnect the Geofence server integration using current settings',
        body: Type.Object({}),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await config.hub.geofenceRefresh();

            res.json({ status: 200, message: 'Geofence Refreshed' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/geofence/status', {
        name: 'Geofence Status',
        group: 'HubGeofence',
        description: 'Return the Geofence server connection status',
        body: Type.Object({}),
        res: GeofenceStatusSchema,
    }, async (req, res) => {
        try {
            res.json(await config.hub.geofenceStatus());
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
