import { db } from './database.ts'
import type { DBConfig } from './database.ts';
import { std } from '../std.ts';
import { liveQuery, type Subscription } from 'dexie';
import type { paths } from '../derived-types.js';

export type FullConfig = paths['/api/config']['get']['responses']['200']['content']['application/json'];

export default class Config<K extends keyof FullConfig = keyof FullConfig> {
    key: K;
    value: FullConfig[K];
    _sub?: Subscription;

    constructor(
        key: K,
        value: FullConfig[K],
    ) {
        this.key = key;
        this.value = value;
    }

    subscribe(): void {
        if (this._sub) return;

        this._sub = liveQuery(() => db.config.get(this.key as string)).subscribe((entry) => {
            if (entry) this.value = entry.value as FullConfig[K];
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

    static async get<K extends keyof FullConfig>(key: K): Promise<Config<K> | undefined> {
        let entry = await db.config.get(key as string);
        if (!entry) {
            await this.refresh([key]);
            entry = await db.config.get(key as string);
        }

        if (!entry) return undefined;
        return new Config<K>(entry.key as K, entry.value as FullConfig[K]);
    }

    static async list(keys: (keyof FullConfig)[]): Promise<Partial<FullConfig>> {
        const result: Partial<FullConfig> = {};

        const db_res = await db.config.bulkGet(keys as string[]);

        const missing: (keyof FullConfig)[] = [];

        db_res.forEach((entry, i) => {
            if (entry) {
                result[entry.key as keyof FullConfig] = entry.value as any;
            } else {
                missing.push(keys[i]);
            }
        });

        if (missing.length) {
            const fresh = await this.refresh(missing);
            Object.assign(result, fresh);
        }

        return result;
    }

    static async refresh(keys: (keyof FullConfig)[]): Promise<Partial<FullConfig>> {
        if (keys.length === 0) return {};

        const url = new URL('/api/config', self.location.origin);
        url.searchParams.append('keys', keys.join(','));

        const res = await std(url) as Partial<FullConfig>;

        const ops: DBConfig[] = [];
        for (const key of Object.keys(res)) {
            ops.push({
                key: key,
                value: res[key as keyof FullConfig]
            });
        }

        if (ops.length) {
            await db.config.bulkPut(ops);
        }

        return res;
}
