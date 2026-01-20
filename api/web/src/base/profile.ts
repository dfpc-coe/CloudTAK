import { db } from './database.ts'
import type { DBProfileConfig } from './database.ts';
import { std, stdurl } from '../std.ts';
import type { Profile } from '../types.ts';

export default class ProfileConfig<T = unknown> {
    key: string;
    value: T;

    constructor(key: string, value: T) {
        this.key = key;
        this.value = value;
    }

    static async get<T = unknown>(key: string): Promise<ProfileConfig<T> | undefined> {
        const entry = await db.profile.get(key);
        if (!entry) return undefined;
        return new ProfileConfig<T>(entry.key, entry.value as T);
    }

    static async put(key: string, value: unknown): Promise<void> {
        await db.profile.put({
            key,
            value
        });
    }

    static async delete(key: string): Promise<void> {
        await db.profile.delete(key);
    }

    static async sync(username: string, opts: {
        refresh?: boolean,
        token?: string
    }  = {}): Promise<void> {
        const count = await db.profile.count();
        if (count > 0 && !opts.refresh) return;

        const fresh = await this.fetch(opts.token);
        await this.saveAll(fresh);
    }

    static async saveAll(profile: Profile): Promise<void> {
        const entries: DBProfileConfig[] = [];
        for (const key of Object.keys(profile)) {
            entries.push({
                key,
                value: profile[key as keyof Profile]
            });
        }
        await db.profile.bulkPut(entries);
    }

    static async toProfile(): Promise<Profile | undefined> {
        const entries = await db.profile.toArray();
        if (!entries.length) return undefined;

        const profile: Record<string, unknown> = {};
        for (const entry of entries) {
            profile[entry.key] = entry.value;
        }

        return profile as unknown as Profile;
    }

    static async fetch(token?: string): Promise<Profile> {
        const url = stdurl('/api/profile');
        const profile = await std(url, { token }) as Profile;
        
        return profile;
    }

    async save(): Promise<void> {
         await ProfileConfig.put(this.key, this.value);
    }
}
