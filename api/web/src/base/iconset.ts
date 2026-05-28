import { liveQuery, type Observable } from 'dexie';
import { db, type DBIconset } from '../database.ts';
import type { IconsetList } from '../types.ts';
import { server, std } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

export type Iconset_ListOptions = BaseInterface_ListOptions & {
    token?: string;
};

export type Iconset_DeleteOptions = {
    localOnly?: boolean;
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
        const cache = await this.hydrated();

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

    static async from(
        uid: string,
        opts?: BaseInterface_FromOptions
    ): Promise<DBIconset | undefined> {
        if (opts?.sync) {
            throw new Error('Sync is not yet supported for individual iconsets');
        }

        return await db.iconset.get(uid);
    }

    static liveFrom(uid: string): Observable<DBIconset | undefined> {
        return liveQuery(async () => {
            return await db.iconset.get(uid);
        });
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

    static async delete(uid: string, opts: Iconset_DeleteOptions = {}): Promise<boolean> {
        if (!opts.localOnly) {
            const { error } = await server.DELETE('/api/iconset/{:iconset}', {
                params: {
                    path: {
                        ':iconset': uid,
                    }
                }
            });

            if (error) throw new Error(error.message);
        }

        const cached = await db.iconset.get(uid);
        if (!cached) return false;

        await db.transaction('rw', db.icon, db.iconset, async () => {
            await db.icon.where('iconset').equals(uid).delete();
            await db.iconset.delete(uid);
        });

        return true;
    }
};
