import Err from '@openaddresses/batch-error';
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import type Config from '../config.js';

export default class ProfileFileControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async ensureReadPermission(file: { username: string; channels?: Array<number | bigint> | null }, email: string): Promise<void> {
        if (file.username === email) return;

        const fileChannels = (file.channels || []).map(channel => Number(channel));
        if (fileChannels.length === 0) {
            throw new Err(403, null, 'You do not have permission to view this asset');
        }

        const profile = await this.config.models.Profile.from(email);
        const api = await TAKAPI.init(
            new URL(String(this.config.server.api)),
            new APIAuthCertificate(profile.auth.cert, profile.auth.key),
        );
        const activeChannels = new Set(
            (await api.Group.list({ useCache: true })).data
                .filter(group => group.active)
                .map(group => group.bitpos),
        );

        if (!fileChannels.some(channel => activeChannels.has(channel))) {
            throw new Err(403, null, 'You do not have permission to view this asset');
        }
    }

    async ensureParentPermission(parentId: string, email: string, childId?: string): Promise<void> {
        const visited = new Set(childId ? [childId] : []);
        let currentParentId: string | null = parentId;

        while (currentParentId) {
            const parent = await this.config.models.ProfileFile.from(currentParentId);
            if (parent.username !== email) {
                throw new Err(403, null, 'You do not have permission to attach this asset to the requested parent');
            } else if (visited.has(parent.id)) {
                throw new Err(400, null, 'Profile asset parent relationships cannot contain cycles');
            }

            visited.add(parent.id);
            currentParentId = parent.parent;
        }
    }
}
