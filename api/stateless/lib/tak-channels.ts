import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import type Config from '../../common/config.js';

/**
 * Resolve the active channel bitpos set for a given Profile or Connection
 * without requiring a pooled TAK connection.
 *
 * `useCache: true` defers caching to the TAK Server, which serves the user's
 * cached group selection - a client-side cache here would go stale across
 * horizontally scaled API instances when channel selections change
 */
export default async function activeChannels(api: TAKAPI): Promise<Set<number>> {
    return new Set(
        (await api.Group.list({ useCache: true })).data
            .filter(group => group.active)
            .map(group => group.bitpos),
    );
}

/**
 * Resolve the active channel bitpos set of a user by email, going through
 * the user's own certificate so the TAK Server applies their channel
 * selection rather than the Admin cert's
 */
export async function userChannels(config: Config, email: string): Promise<Set<number>> {
    const profile = await config.models.Profile.from(email);

    const api = await TAKAPI.init(
        new URL(String(config.server.api)),
        new APIAuthCertificate(profile.auth.cert, profile.auth.key),
    );

    return await activeChannels(api);
}
