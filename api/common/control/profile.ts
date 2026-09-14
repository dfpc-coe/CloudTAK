import Err from '@openaddresses/batch-error';
import type { InferSelectModel } from 'drizzle-orm';
import type { Static } from '@sinclair/typebox';
import type Config from '../config.js';
import type { Profile } from '../schema.js';
import type { ConnectionAuth } from '../connection-config.js';

/**
 * A Profile that has logged in at least once and therefore holds a TAK certificate.
 * Provisioned Profiles (SCIM) have a null auth until their first login
 */
export type AuthenticatedProfile = Omit<InferSelectModel<typeof Profile>, 'auth'> & {
    auth: Static<typeof ConnectionAuth>;
};

/**
 * Get a Profile that must hold a TAK certificate - rejects provisioned users that have not yet logged in
 */
export async function authenticatedProfile(config: Config, username: string): Promise<AuthenticatedProfile> {
    const profile = await config.models.Profile.from(username);

    if (!profile.auth) {
        throw new Err(401, null, 'User has been provisioned but has not yet logged in');
    }

    return profile as AuthenticatedProfile;
}
