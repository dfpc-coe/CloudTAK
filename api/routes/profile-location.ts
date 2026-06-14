import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { CoTParser } from '@tak-ps/node-cot';
import { Type } from '@sinclair/typebox';
import { StandardResponse } from '../lib/types.js';
import { ProfileConnConfig } from '../lib/connection-config.js';
import ProfileControl from '../lib/control/profile.js';

export default async function router(schema: Schema, config: Config) {
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
            altitude: Type.Optional(Type.Number()),
            accuracy: Type.Optional(Type.Number()),
            altitudeAccuracy: Type.Optional(Type.Number()),
            speed: Type.Optional(Type.Number()),
            bearing: Type.Optional(Type.Number()),
            time: Type.Optional(Type.Number()),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await profileControl.from(user.email);
            const rawProfile = await config.models.Profile.from(user.email);

            // Ensure the user's TAK profile connection exists and is ready
            let pooledClient = config.conns.get(user.email);
            let awaitSecure: Promise<void> | undefined;

            if (!pooledClient) {
                if (!rawProfile.auth?.cert || !rawProfile.auth?.key) {
                    throw new Err(400, null, 'Profile auth certificate not configured');
                }

                pooledClient = await config.conns.add(
                    new ProfileConnConfig(config, user.email, rawProfile.auth),
                );
                if (pooledClient!.tak.client && !pooledClient!.tak.client.authorized) {
                    awaitSecure = new Promise<void>(resolve =>
                        pooledClient!.tak.once('secureConnect', resolve),
                    );
                }
            }

            if (awaitSecure) await awaitSecure;

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
                    ...(req.body.accuracy !== undefined && { ce: req.body.accuracy }),
                    ...(req.body.speed !== undefined && { speed: req.body.speed }),
                    ...(req.body.bearing !== undefined && { course: req.body.bearing }),
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

            pooledClient.tak.write([cot], { stripFlow: true });

            res.json({
                status: 200,
                message: 'Location submitted',
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
