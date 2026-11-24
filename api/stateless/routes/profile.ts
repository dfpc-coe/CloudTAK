import { Static } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../../common/auth.js';
import { ProfileResponse, ProfilePatchBody } from '../../common/types.js';
import type ConfigStateless from '../config.js';
import { sql } from 'drizzle-orm';
import ProfileControl from '../lib/control/profile.js';
import { isCoordinateMode } from '../../common/coordinate-systems.js';

type ProfilePatchBodyType = Static<typeof ProfilePatchBody>;
type ProfilePatchValue = ProfilePatchBodyType[keyof ProfilePatchBodyType];

export default async function router(schema: Schema, config: ConfigStateless) {
    const profileControl = new ProfileControl(config);

    await schema.get('/profile', {
        name: 'Get Profile',
        group: 'Profile',
        description: 'Get User\'s Profile',
        res: ProfileResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await profileControl.from(user.email);

            res.json(profile);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/profile', {
        name: 'Update Profile',
        group: 'Profile',
        description: 'Update User\'s Profile',
        body: ProfilePatchBody,
        res: ProfileResponse,
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const profileBody = req.body as ProfilePatchBodyType;

            // Fields the IdP owns are silently dropped rather than rejected: the
            // response below echoes the authoritative values, so a stale client
            // self-corrects instead of erroring. The UI disables these inputs, so
            // reaching here means either an out-of-date client or a direct API call.
            if (profileBody.display_coordinate !== undefined && !isCoordinateMode(profileBody.display_coordinate)) {
                throw new Err(400, null, `Unknown coordinate format: ${profileBody.display_coordinate}`);
            }
            const locked = await profileControl.lockedFields(user.email);

            const profile_config: Record<string, ProfilePatchValue> = {};
            for (const key of Object.keys(profileBody) as Array<keyof ProfilePatchBodyType>) {
                if (locked.has(String(key))) {
                    console.warn(`Ignoring update to IdP-managed profile field ${String(key)} for ${user.email}`);
                    continue;
                }

                profile_config[String(key).replace('_', '::')] = profileBody[key];
            }

            await config.models.ProfileConfig.commit(user.email, profile_config);

            await config.models.Profile.commit(user.email, {
                updated: sql`Now()`,
            });

            const profile = await profileControl.from(user.email);

            res.json(profile);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
