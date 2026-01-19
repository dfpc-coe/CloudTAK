import { Pool } from '@openaddresses/batch-generic';
import { ProfileSetting } from '../schema.js';
import { eq } from 'drizzle-orm';
import * as pgtypes from '../schema.js';

export default class ProfileConfigModel {
    pool: Pool<typeof pgtypes>;

    constructor(pool: Pool<typeof pgtypes>) {
        this.pool = pool;
    }

    async from(username: string): Promise<Record<string, any>> {
        const settings = await this.pool
            .select()
            .from(ProfileSetting)
            .where(eq(ProfileSetting.username, username));

        const config: Record<string, any> = {};
        for (const setting of settings) {
             try {
                config[setting.key] = JSON.parse(setting.value);
            } catch (err) {
                config[setting.key] = setting.value;
            }
        }
        return config;
    }

    async commit(username: string, config: Record<string, any>): Promise<Record<string, any>> {
        const timestamp = new Date().toISOString();

        for (const key of Object.keys(config)) {
             let value = config[key];
             if (value === undefined) continue;
             if (typeof value !== 'string') value = JSON.stringify(value);

             await this.pool.insert(ProfileSetting)
                .values({
                    username,
                    key,
                    value,
                    updated: timestamp
                })
                .onConflictDoUpdate({
                    target: [ProfileSetting.username, ProfileSetting.key],
                    set: { value, updated: timestamp }
                })
        }

        return this.from(username);
    }
}
