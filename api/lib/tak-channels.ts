import type { TAKAPI } from '@tak-ps/node-tak';

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
