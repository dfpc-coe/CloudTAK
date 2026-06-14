import { Static } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { ProfileResponse, ProfilePatchBody } from '../lib/types.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import ProfileControl from '../lib/control/profile.js';

type ProfilePatchBodyType = Static<typeof ProfilePatchBody>;
type ProfilePatchValue = ProfilePatchBodyType[keyof ProfilePatchBodyType];

export default async function router(schema: Schema, config: Config) {
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
            const profile_config: Record<string, ProfilePatchValue> = {};
            for (const key of Object.keys(profileBody) as Array<keyof ProfilePatchBodyType>) {
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
