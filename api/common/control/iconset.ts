import Err from '@openaddresses/batch-error';
import type Config from '../config.js';

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
}
