import { db } from './database.ts'
import type { DBProfileConfig } from './database.ts';
import { std } from '../std.ts';
import type { Profile } from '../types.ts';
import { liveQuery, type Subscription } from 'dexie';

export default class ProfileConfig<T = unknown> {
    key: string;
    value: T;
    _sub?: Subscription;

    constructor(
        key: string,
        value: T,
    ) {
        this.key = key;
        this.value = value;
    }

    subscribe(): void {
        if (this._sub) return;

        this._sub = liveQuery(() => db.profile.get(this.key)).subscribe((entry) => {
            if (entry) this.value = entry.value as T;
        });
    }

    subscribed(): boolean {
        return !!this._sub;
    }

    destroy(): void {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    static async get<T = unknown>(key: string): Promise<ProfileConfig<T> | undefined> {
        const entry = await db.profile.get(key);
        if (!entry) return undefined;
        return new ProfileConfig<T>(entry.key, entry.value as T);
    }

    async commit(value: T): Promise<void> {
        await db.profile.put({
            key: this.key,
            value
        });

        await std('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ [this.key]: value })
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
}
