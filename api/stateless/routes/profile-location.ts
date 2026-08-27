import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { CoTParser } from '@tak-ps/node-cot';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { StandardResponse } from '../../common/types.js';
import ProfileControl from '../lib/control/profile.js';

export default async function router(schema: Schema, config: ConfigStateless) {
    const profileControl = new ProfileControl(config);

    const LocationBody = Type.Object({
        longitude: Type.Number(),
        latitude: Type.Number(),
        altitude: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        accuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        altitudeAccuracy: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        speed: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        bearing: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
        time: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    });

    const description = `
        Submit a live location update for the authenticated user.
        Only the raw coordinates are required — all profile fields
        (callsign, TAK type, group, role, remarks) are read from the
        authenticated user's saved profile, and the CoT UID is derived
        server-side from their email.

        Null values are accepted for optional fields so the payload emitted
        directly by native location services can be posted unmodified.
    `;

    const submit = async (email: string, body: Static<typeof LocationBody>): Promise<void> => {
        const profile = await profileControl.from(email);

        const num = (v: number | null | undefined): number | undefined => (typeof v === 'number' ? v : undefined);

        const now = body.time ? new Date(body.time) : new Date();
        const stale = new Date(now.getTime() + 60_000);
        const callsign = profile.tak_callsign || 'Unknown';
        const uid = `ANDROID-CloudTAK-${email}`;

        const accuracy = num(body.accuracy);
        const speed = num(body.speed);
        const bearing = num(body.bearing);

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
                center: [body.longitude, body.latitude],
                remarks: profile.tak_remarks || '',
                ...(accuracy !== undefined && { ce: accuracy }),
                ...(speed !== undefined && { speed }),
                ...(bearing !== undefined && { course: bearing }),
                droid: callsign,
                contact: { endpoint: '*:-1:stcp', callsign },
                group: { name: profile.tak_group || 'Cyan', role: profile.tak_role || 'Team Member' },
            },
            geometry: {
                type: 'Point' as const,
                coordinates: [body.longitude, body.latitude, num(body.altitude) ?? 0],
            },
        };

        const cot = await CoTParser.from_geojson(feature);

        await config.hub.submitCots({
            connection: email,
            cots: [cot],
            ensureProfile: true,
        });
    };

    await schema.put('/profile/location', {
        name: 'Submit Location',
        group: 'ProfileLocation',
        description,
        body: LocationBody,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await submit(user.email, req.body);

            res.json({
                status: 200,
                message: 'Location submitted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    // Native background location services can only POST
    await schema.post('/profile/location', {
        name: 'Submit Location (POST)',
        group: 'ProfileLocation',
        description,
        body: LocationBody,
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            await submit(user.email, req.body);

            res.json({
                status: 200,
                message: 'Location submitted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
