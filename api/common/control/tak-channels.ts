import { TAKAPI } from '@tak-ps/node-tak';
import type Config from '../config.js';
import type { HubClient } from '../hub/index.js';
import TAKServerControl from './takserver.js';

// Resolvable from either config class; the base Config carries no hub
type ChannelConfig = Config & { hub?: HubClient };

/**
 * Resolve the active channel bitpos set through a TAK API client.
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
 * Active channel set cached on the hub's pooled connection, or null when the
 * connection is not pooled (or the hub is unreachable) and the caller must
 * ask the TAK Server directly
 */
async function hubChannels(config: ChannelConfig, id: number | string): Promise<Set<number> | null> {
    if (!config.hub) return null;

    try {
        const channels = await config.hub.connectionChannels(id);
        return channels ? new Set(channels) : null;
    } catch (err) {
        console.error(`not ok - hub channel lookup failed for ${id}, falling back to TAK Server:`, err instanceof Error ? err.message : err);
        return null;
    }
}

/**
 * Resolve the active channel bitpos set of a user by email - from the hub
 * while the user holds a pooled connection, otherwise through the user's own
 * certificate so the TAK Server applies their channel selection rather than
 * the Admin cert's
 */
export async function userChannels(config: ChannelConfig, email: string): Promise<Set<number>> {
    const cached = await hubChannels(config, email);
    if (cached) return cached;

    const api = await new TAKServerControl(config).asUser(email);

    return await activeChannels(api);
}

/**
 * Resolve the active channel bitpos set of a Connection - from the hub while
 * the Connection is pooled, otherwise through its own certificate
 */
export async function connectionChannels(config: ChannelConfig, connection: { id: number; auth: { cert: string; key: string } }): Promise<Set<number>> {
    const cached = await hubChannels(config, connection.id);
    if (cached) return cached;

    const api = await new TAKServerControl(config).asConnection(connection);

    return await activeChannels(api);
}
