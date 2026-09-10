import Modeler from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { InferSelectModel } from 'drizzle-orm';
import type { Static } from '@sinclair/typebox';
import { Profile } from '../schema.js';
import type { ConnectionAuth } from '../connection-config.js';

/**
 * A Profile that has logged in at least once and therefore holds a TAK certificate.
 * Provisioned Profiles (SCIM) have a null auth until their first login
 */
export type AuthenticatedProfile = Omit<InferSelectModel<typeof Profile>, 'auth'> & {
    auth: Static<typeof ConnectionAuth>;
};

export default class ProfileModel extends Modeler<typeof Profile> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Profile);
    }

    /**
     * Get a Profile that must hold a TAK certificate - rejects provisioned users that have not yet logged in
     */
    async withAuth(username: string): Promise<AuthenticatedProfile> {
        const profile = await this.from(username);

        if (!profile.auth) {
            throw new Err(401, null, 'User has been provisioned but has not yet logged in');
        }

        return profile as AuthenticatedProfile;
    }
}
