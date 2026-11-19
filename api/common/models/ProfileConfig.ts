import { Pool } from '@openaddresses/batch-generic';
import { ProfileSetting } from '../schema.js';
import { eq } from 'drizzle-orm';
import * as pgtypes from '../schema.js';

export default class ProfileConfigModel {
    pool: Pool<typeof pgtypes>;

    constructor(pool: Pool<typeof pgtypes>) {
        this.pool = pool;
    }

    async from(username: string): Promise<Record<string, unknown>> {
        const settings = await this.pool
            .select()
            .from(ProfileSetting)
            .where(eq(ProfileSetting.username, username));

        const config: Record<string, unknown> = {};
        for (const setting of settings) {
            try {
                config[setting.key] = JSON.parse(setting.value);
            } catch {
                config[setting.key] = setting.value;
            }
        }
        return config;
    }

    async commit(username: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
        const timestamp = new Date().toISOString();

        for (const key of Object.keys(config)) {
            const raw = config[key];
            if (raw === undefined) continue;
            const value = typeof raw === 'string' ? raw : JSON.stringify(raw);

            await this.pool.insert(ProfileSetting)
                .values({
                    username,
                    key,
                    value,
                    updated: timestamp,
                })
                .onConflictDoUpdate({
                    target: [ProfileSetting.username, ProfileSetting.key],
                    set: { value, updated: timestamp },
                });
        }

        return this.from(username);
    }
}
