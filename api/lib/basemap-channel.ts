import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import Config from './config.js';
import { AuthUser, AuthUserAccess } from './auth.js';

export async function getActiveChannels(config: Config, user: AuthUser): Promise<Set<number>> {
    const poolConn = config.conns.get(user.email);
    if (poolConn) return poolConn.channels;

    const profile = await config.models.Profile.from(user.email);
    const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

    return new Set(
        (await api.Group.list({ useCache: true })).data
            .filter((group) => group.active)
            .map((group) => group.bitpos)
    );
}

export async function hasBasemapChannelAccess(config: Config, user: AuthUser, basemap: {
    channels?: Array<number>;
}): Promise<boolean> {
    if (user.access === AuthUserAccess.ADMIN) return true;

    const channels = basemap.channels || [];
    if (!channels.length) return true;

    const activeChannels = await getActiveChannels(config, user);
    return channels.some((channel) => activeChannels.has(channel));
}
