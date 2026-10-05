import type ConfigStateless from '../config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { CoTParser } from '@tak-ps/node-cot';
import type { Static } from '@sinclair/typebox';
import { StandardResponse } from '../../common/types.js';
import ProfileControl from '../lib/control/profile.js';
import { ProfileLocationBody, selfLocationFeature } from '../lib/profile-location.js';
import type { Request, Response } from 'express';

export default async function router(schema: Schema, config: ConfigStateless) {
    const profileControl = new ProfileControl(config);

    const submit = async (
        req: Request<unknown, Static<typeof StandardResponse>, Static<typeof ProfileLocationBody>>,
        res: Response<Static<typeof StandardResponse>>,
    ) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await profileControl.from(user.email);

            const cot = await CoTParser.from_geojson(selfLocationFeature(user.email, profile, req.body));

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
    };

    await schema.put('/profile/location', {
        name: 'Submit Location',
        group: 'ProfileLocation',
        description: `
            Submit a live location update for the authenticated user.
            Only the raw coordinates are required — callsign, group, role
            and remarks are read from the authenticated user's saved profile,
            and the CoT UID is derived server-side from their email.
        `,
        body: ProfileLocationBody,
        res: StandardResponse,
    }, submit);

    await schema.post('/profile/location', {
        name: 'Submit Location (POST)',
        group: 'ProfileLocation',
        description: `
            Submit a live location update for the authenticated user.
            Identical to the PUT route - native background location services
            can only POST, and emit null for unavailable optional fields.
        `,
        body: ProfileLocationBody,
        res: StandardResponse,
    }, submit);
}
