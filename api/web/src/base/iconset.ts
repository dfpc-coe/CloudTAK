import { liveQuery, type Observable } from 'dexie';
import { db, type DBIconset } from '../database.ts';
import type { IconsetList } from '../types.ts';
import { std } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions
} from './interface.ts';

export type Iconset_ListOptions = BaseInterface_ListOptions & {
    token?: string;
};

export default class IconsetManager extends BaseInterface {
    static readonly listCacheKey = 'iconset';

    static async count(): Promise<number> {
        return await db.iconset.count();
    }

    static liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.iconset.count();
        });
    }

    /**
     * Return all locally cached iconsets ordered by name.
     */
    static async list(opts: Iconset_ListOptions = {}): Promise<DBIconset[]> {
        const cache = await db.cache.get(this.listCacheKey);

        if (!cache || opts.sync) {
            await this.sync(opts.token);
        }

        return await db.iconset.orderBy('name').toArray();
    }

    static liveList(): Observable<DBIconset[]> {
        return liveQuery(async () => {
            return await db.iconset.orderBy('name').toArray();
        });
    }

    static async get(uid: string): Promise<DBIconset | undefined> {
        return await db.iconset.get(uid);
    }

    static async sync(token?: string): Promise<void> {
        const res = await std('/api/iconset?limit=0', { token }) as IconsetList;

        await db.transaction('rw', db.iconset, db.cache, async () => {
            await db.iconset.clear();

            if (res.items.length) {
                await db.iconset.bulkPut(res.items);
            }

            await db.cache.put({
                key: this.listCacheKey,
                updated: Date.now()
            });
        });
    }
};
