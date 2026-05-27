import { liveQuery, type Observable } from 'dexie';
import { db, type DBKV } from '../database.ts';
import BaseInterface from './interface.ts';

export default class KV extends BaseInterface {
    static readonly listCacheKey = 'kv';

    static async count(): Promise<number> {
        return await db.kv.count();
    }

    static liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.kv.count();
        });
    }

    static async list(): Promise<DBKV[]> {
        return await db.kv.orderBy('key').toArray();
    }

    static liveList(): Observable<DBKV[]> {
        return liveQuery(async () => {
            return await db.kv.orderBy('key').toArray();
        });
    }

    static async sync(): Promise<void> {
        await db.cache.put({
            key: this.listCacheKey,
            updated: Date.now()
        });
    }

    static async from(key: string): Promise<DBKV | undefined> {
        return await db.kv.get(key);
    }

    static liveFrom(key: string): Observable<DBKV | undefined> {
        return liveQuery(async () => {
            return await db.kv.get(key);
        });
    }

    static async generate(key?: string, value?: string): Promise<void> {
        await this.update(key, value);
    }

    static async update(key?: string, value?: string): Promise<void> {
        if (!key) throw new Error('KV key is required');
        if (value === undefined) throw new Error('KV value is required');

        await db.kv.put({ key, value });
    }

    static async value(key: string): Promise<string | undefined> {
        return (await this.from(key))?.value;
    }

    static async delete(key: string): Promise<void> {
        await db.kv.delete(key);
    }
}
