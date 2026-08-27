import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { CoTParser } from '@tak-ps/node-cot';
import { Type } from '@sinclair/typebox';
import { StandardResponse } from '../../common/types.js';
import ProfileControl from '../lib/control/profile.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const profileControl = new ProfileControl(config);

    await schema.put('/profile/location', {
        name: 'Submit Location',
        group: 'ProfileLocation',
        description: `
            Submit a live location update for the authenticated user.
            Only the raw coordinates are required — all profile fields
            (callsign, TAK type, group, role, remarks) are read from the
            authenticated user's saved profile, and the CoT UID is derived
            server-side from their email.
        `,
        body: Type.Object({
            longitude: Type.Number(),
            latitude: Type.Number(),
            altitude: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            accuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            altitudeAccuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            speed: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            bearing: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            time: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await profileControl.from(user.email);

            const now = req.body.time ? new Date(req.body.time) : new Date();
            const stale = new Date(now.getTime() + 60_000);
            const callsign = profile.tak_callsign || 'Unknown';
            const uid = `ANDROID-CloudTAK-${user.email}`;

            const feature = {
                id: uid,
                type: 'Feature' as const,
                path: '/',
                properties: {
                    callsign,
                    type: profile.tak_type || 'a-f-G-E-V-C',
                    how: 'm-g',
                    time: now.toISOString(),
                    start: now.toISOString(),
                    stale: stale.toISOString(),
                    center: [req.body.longitude, req.body.latitude],
                    remarks: profile.tak_remarks || '',
                    ...(typeof req.body.accuracy === 'number' && { ce: req.body.accuracy }),
                    ...(typeof req.body.speed === 'number' && { speed: req.body.speed }),
                    ...(typeof req.body.bearing === 'number' && { course: req.body.bearing }),
                    droid: callsign,
                    contact: { endpoint: '*:-1:stcp', callsign },
                    group: { name: profile.tak_group || 'Cyan', role: profile.tak_role || 'Team Member' },
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [req.body.longitude, req.body.latitude, req.body.altitude ?? 0],
                },
            };

            const cot = await CoTParser.from_geojson(feature);

            await config.hub.submitCots({
                connection: user.email,
                cots: [cot],
                ensureProfile: true,
            });

            res.json({
                status: 200,
                message: 'Location submitted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/profile/location', {
        name: 'Submit Location (POST)',
        group: 'ProfileLocation',
        description: `
            Submit a live location update for the authenticated user.
            Identical to the PUT route - native background location services
            can only POST, and emit null for unavailable optional fields.
        `,
        body: Type.Object({
            longitude: Type.Number(),
            latitude: Type.Number(),
            altitude: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            accuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            altitudeAccuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            speed: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            bearing: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
            time: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await profileControl.from(user.email);

            const now = req.body.time ? new Date(req.body.time) : new Date();
            const stale = new Date(now.getTime() + 60_000);
            const callsign = profile.tak_callsign || 'Unknown';
            const uid = `ANDROID-CloudTAK-${user.email}`;

            const feature = {
                id: uid,
                type: 'Feature' as const,
                path: '/',
                properties: {
                    callsign,
                    type: profile.tak_type || 'a-f-G-E-V-C',
                    how: 'm-g',
                    time: now.toISOString(),
                    start: now.toISOString(),
                    stale: stale.toISOString(),
                    center: [req.body.longitude, req.body.latitude],
                    remarks: profile.tak_remarks || '',
                    ...(typeof req.body.accuracy === 'number' && { ce: req.body.accuracy }),
                    ...(typeof req.body.speed === 'number' && { speed: req.body.speed }),
                    ...(typeof req.body.bearing === 'number' && { course: req.body.bearing }),
                    droid: callsign,
                    contact: { endpoint: '*:-1:stcp', callsign },
                    group: { name: profile.tak_group || 'Cyan', role: profile.tak_role || 'Team Member' },
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [req.body.longitude, req.body.latitude, req.body.altitude ?? 0],
                },
            };

            const cot = await CoTParser.from_geojson(feature);

            await config.hub.submitCots({
                connection: user.email,
                cots: [cot],
                ensureProfile: true,
            });

            res.json({
                status: 200,
                message: 'Location submitted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
