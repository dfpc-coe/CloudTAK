import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileResponse } from '../lib/types.js'
import Config from '../lib/config.js';
import { TAKRole, TAKGroup } from '../lib/api/types.js'
import { sql } from 'drizzle-orm';
import { Profile_Text, Profile_Stale, Profile_Speed, Profile_Elevation, Profile_Distance, Profile_Projection } from  '../lib/enums.js';

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
            res.json(profile);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/profile', {
        name: 'Update Profile',
        group: 'Profile',
        description: 'Update User\'s Profile',
        body: Type.Object({
            display_stale: Type.Optional(Type.Enum(Profile_Stale)),
            display_distance: Type.Optional(Type.Enum(Profile_Distance)),
            display_elevation: Type.Optional(Type.Enum(Profile_Elevation)),
            display_projection: Type.Optional(Type.Enum(Profile_Projection)),
            display_speed: Type.Optional(Type.Enum(Profile_Speed)),
            display_text: Type.Optional(Type.Enum(Profile_Text)),
            tak_callsign: Type.Optional(Type.String()),
            tak_remarks: Type.Optional(Type.String()),
            tak_group: Type.Optional(Type.Enum(TAKGroup)),
            tak_role: Type.Optional(Type.Enum(TAKRole)),
            tak_loc_freq: Type.Optional(Type.Integer()),
            tak_loc: Type.Optional(Type.Union([Type.Null(), Type.Object({
                type: Type.String(),
                coordinates: Type.Array(Type.Number())
            })]))
        }),
        res: ProfileResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.commit(user.email, {
                ...req.body,
                updated: sql`Now()`
            });

            // @ts-expect-error Update Batch-Generic to specify actual geometry type (Point) instead of Geometry
            res.json(profile);
        } catch (err) {
             Err.respond(err, res);
        }
    });

}
