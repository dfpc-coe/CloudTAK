import Err from '@openaddresses/batch-error';
import { eq } from 'drizzle-orm';
import type Config from '../config.js';
import { AuthUserAccess } from '../auth.js';
import { ProfileFile, ProfileFileChannel } from '../schema.js';
import { userChannels } from './tak-channels.js';

export default class IconsetControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async ensurePermission(iconset: string | null | undefined, email: string): Promise<void> {
        if (iconset === undefined || iconset === null || iconset === '') return;

        const result = await this.config.models.Iconset.from(iconset);
        if (result.username !== email) {
            throw new Err(403, null, `You do not have permission to associate iconset '${iconset}'`);
        }
    }

    /** Readable by the owner, elevated users, or anyone holding a channel a file using the iconset is shared to */
    async ensureReadPermission(
        iconset: { uid: string; username: string | null },
        user: { email: string; access: AuthUserAccess },
    ): Promise<void> {
        if (!iconset.username || iconset.username === user.email || user.access !== AuthUserAccess.USER) return;

        const shared = await this.config.pg
            .selectDistinct({ channel: ProfileFileChannel.channel })
            .from(ProfileFileChannel)
            .innerJoin(ProfileFile, eq(ProfileFile.id, ProfileFileChannel.file))
            .where(eq(ProfileFile.iconset, iconset.uid));

        if (shared.length) {
            const active = await userChannels(this.config, user.email);
            if (shared.some(row => active.has(Number(row.channel)))) return;
        }

        throw new Err(400, null, 'You don\'t have permission to access this resource');
    }
}
