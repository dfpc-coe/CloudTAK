import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileResponse } from '../lib/types.js'
import Config from '../lib/config.js';
import { TAKRole, TAKGroup } from '@tak-ps/node-tak/lib/api/types'
import { sql } from 'drizzle-orm';
import { Profile_Text, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Projection, Profile_Zoom } from  '../lib/enums.js';

export const FullProfileConfig = Type.Object({
    'display::stale': Type.Enum(Profile_Stale, { default: Profile_Stale.TenMinutes }),
    'display::distance': Type.Enum(Profile_Distance, { default: Profile_Distance.MILE }),
    'display::elevation': Type.Enum(Profile_Elevation, { default: Profile_Elevation.FEET }),
    'display::projection': Type.Enum(Profile_Projection, { default: Profile_Projection.GLOBE }),
    'display::speed': Type.Enum(Profile_Speed, { default: Profile_Speed.MPH }),
    'display::zoom': Type.Enum(Profile_Zoom, { default: Profile_Zoom.CONDITIONAL }),
    'display::icon_rotation': Type.Boolean({ default: true }),
    'display::text': Type.Enum(Profile_Text, { default: Profile_Text.Medium }),
    'tak::callsign': Type.String({ default: 'CloudTAK User' }),
    'tak::remarks': Type.String({ default: 'CloudTAK User' }),
    'tak::group': Type.Enum(TAKGroup, { default: TAKGroup.ORANGE }),
    'tak::type': Type.String({ default: 'a-f-G-E-V-C' }),
    'tak::role': Type.Enum(TAKRole, { default: TAKRole.TEAM_MEMBER }),
    'tak::loc_freq': Type.Integer({ default: 2000 }),
    'tak::loc': Type.Union([Type.Null(), Type.Object({
        type: Type.String(),
        coordinates: Type.Array(Type.Number())
    })])
});

export default async function router(schema: Schema, config: Config) {
    await schema.get('/profile', {
        name: 'Get Profile',
        group: 'Profile',
        description: 'Get User\'s Profile',
        res: ProfileResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);

            // @ts-expect-error Update Batch-Generic to specify actual geometry type (Point) instead of Geometry
            res.json({
                active: config.wsClients.has(profile.username),
                ...profile
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/profile', {
        name: 'Update Profile',
        group: 'Profile',
        description: 'Update User\'s Profile',
        body: Type.Partial(FullProfileConfig),
        res: ProfileResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profile = await config.models.Profile.commit(user.email, {
                ...req.body,
                updated: sql`Now()`
            });

            // @ts-expect-error Update Batch-Generic to specify actual geometry type (Point) instead of Geometry
            res.json({
                active: config.wsClients.has(profile.username),
                ...profile
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

}
