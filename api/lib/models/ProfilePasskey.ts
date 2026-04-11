import Modeler from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ProfilePasskey, ProfilePasskeyChallenge } from '../schema.js';
import { eq, lt } from 'drizzle-orm';

const CHALLENGE_TTL_MS = 60_000;

export default class ProfilePasskeyModel extends Modeler<typeof ProfilePasskey> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, ProfilePasskey);
    }

    async forUser(username: string) {
        return await this.pool.select()
            .from(this.generic)
            .where(eq(this.generic.username, username));
    }

    async byCredentialId(credentialId: string) {
        const results = await this.pool.select()
            .from(this.generic)
            .where(eq(this.generic.credential_id, credentialId));
        if (!results.length) throw new Error('Passkey not found');
        return results[0];
    }

    async updateCounter(id: number, counter: number) {
        await this.pool.update(this.generic)
            .set({
                counter,
                last_used: new Date().toISOString()
            })
            .where(eq(this.generic.id, id));
    }

    async setChallenge(key: string, challenge: string): Promise<void> {
        // Clean up expired challenges opportunistically
        await this.pool.delete(ProfilePasskeyChallenge)
            .where(lt(ProfilePasskeyChallenge.expires, new Date().toISOString()));

        await this.pool.insert(ProfilePasskeyChallenge)
            .values({
                key,
                challenge,
                expires: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
            })
            .onConflictDoUpdate({
                target: ProfilePasskeyChallenge.key,
                set: {
                    challenge,
                    expires: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
                },
            });
    }

    async consumeChallenge(key: string): Promise<string> {
        const results = await this.pool.delete(ProfilePasskeyChallenge)
            .where(eq(ProfilePasskeyChallenge.key, key))
            .returning();

        if (!results.length) {
            throw new Err(400, null, 'Challenge expired or not found');
        }

        const entry = results[0];
        if (new Date(entry.expires) < new Date()) {
            throw new Err(400, null, 'Challenge expired or not found');
        }

        return entry.challenge;
    }
}
