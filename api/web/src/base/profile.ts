import { db } from './database.ts'
import type { DBProfileConfig } from './database.ts';
import { std, stdurl } from '../std.ts';
import type { Profile } from '../types.ts';

export default class ProfileConfig {
    username: string;
    config: Profile;

    constructor(data: Profile) {
        this.username = data.username;
        this.config = data;
    }

    static async from(): Promise<ProfileConfig | undefined> {
        const entries = await db.profile.toArray();

        // If specific keys are missing, we should probably treat it as not found or partial?
        // For now, if table is empty, return undefined
        if (!entries.length) return;

        const profile: any = {};
        for (const entry of entries) {
            profile[entry.key] = entry.value;
        }

        return new ProfileConfig(profile as Profile);
    }

    static async load(username: string, opts: {
        refresh?: boolean,
        token?: string
    } = {}): Promise<ProfileConfig> {
        const exists = await this.from(username);
        if (exists) {
            if (opts.refresh) await exists.refresh(opts.token);
            return exists;
        }

        const fresh = await this.fetch(opts.token);
        await this.put(fresh);

        return new ProfileConfig(fresh);
    }

    static async put(profile: Profile): Promise<void> {
        const entries: DBProfileConfig[] = [];

        for (const key of Object.keys(profile)) {
            entries.push({
                key,
                value: (profile as any)[key]
            });
        }

        await db.profile.bulkPut(entries);
    }

    static async fetch(token?: string): Promise<Profile> {
        const url = stdurl('/api/profile');
        const profile = await std(url, { token }) as Profile;
        
        return profile;
    }

    async refresh(token?: string): Promise<void> {
        const profile = await ProfileConfig.fetch(token);
        await ProfileConfig.put(profile);
        this.config = profile;
    }
    
    async save(): Promise<void> {
         await ProfileConfig.put(this.config);
    }
}
