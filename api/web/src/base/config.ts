import { db } from '../database.ts'
import type { DBConfig } from '../database.ts';
import { server } from '../std.ts';
import { withTimeout } from './async.ts';
import { liveQuery, type Subscription } from 'dexie';
import type { paths } from '@cloudtak/api-types';

export type FullConfig = paths['/api/config']['get']['responses']['200']['content']['application/json'];

// Config is read during boot, so its I/O must always settle: a stalled
// cache read falls through to the network; a stalled cache write is dropped.
const CACHE_TIMEOUT_MS = 2000;
const FETCH_TIMEOUT_MS = 10000;

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
        const result = await this.list([key]);

        if (result[key] === undefined) return undefined;
        return new Config<K>(key, result[key] as FullConfig[K]);
    }

    static async list(
        keys: (keyof FullConfig)[],
        opts: {
            defaults?: Partial<FullConfig>
        } = {}
    ): Promise<Partial<FullConfig>> {
        const result: Partial<FullConfig> = {};

        let db_res: (DBConfig | undefined)[];
        try {
            db_res = await withTimeout(db.config.bulkGet(keys as string[]), CACHE_TIMEOUT_MS, 'Config cache read');
        } catch (err) {
            console.warn('Config cache read failed, falling back to the network', err);
            db_res = keys.map(() => undefined);
        }

        const missing: (keyof FullConfig)[] = [];

        db_res.forEach((entry, i) => {
            if (entry) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                result[entry.key as keyof FullConfig] = entry.value as any;
            } else {
                missing.push(keys[i]);
            }
        });

        if (missing.length) {
            const fresh = await this.refresh(missing);
            Object.assign(result, fresh);
        }

        if (opts.defaults) {
            const defaultsToSave: DBConfig[] = [];
            for (const key of keys) {
                if (result[key] === undefined && opts.defaults[key] !== undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result[key] = opts.defaults[key] as any;
                    defaultsToSave.push({
                        key: String(key),
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        value: opts.defaults[key] as any
                    });
                }
            }

            await this.persist(defaultsToSave);
        }

        return result;
    }

    static async refresh(keys: (keyof FullConfig)[]): Promise<Partial<FullConfig>> {
        if (keys.length === 0) return {};

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        let res;
        try {
            res = await server.GET('/api/config', {
                params: { query: { keys: keys.join(',') } },
                signal: controller.signal
            });
        } catch (err) {
            if (controller.signal.aborted) {
                throw new Error('Configuration request timed out', { cause: err });
            }

            throw err;
        } finally {
            clearTimeout(timer);
        }

        if (res.error) throw new Error(res.error.message);

        const data = res.data as Partial<FullConfig>;

        const ops: DBConfig[] = [];
        for (const key of Object.keys(data)) {
            ops.push({
                key: key,
                value: data[key as keyof FullConfig]
            });
        }

        await this.persist(ops);

        return data;
    }

    // Best-effort cache write — must not hang or fail the request that
    // produced the values.
    private static async persist(ops: DBConfig[]): Promise<void> {
        if (!ops.length) return;

        try {
            await withTimeout(db.config.bulkPut(ops), CACHE_TIMEOUT_MS, 'Config cache write');
        } catch (err) {
            console.warn('Failed to cache config values', err);
        }
    }
}
