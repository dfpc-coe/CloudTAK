import { liveQuery, type Observable } from 'dexie';
import { db, type DBIconset } from '../database.ts';
import type { paths } from '@cloudtak/api-types';
import type { Iconset, IconsetList } from '../types.ts';
import { downloadUrl, getRuntimeToken, server } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

export type Iconset_Create = paths['/api/iconset']['post']['requestBody']['content']['application/json'];
export type Iconset_Update = paths['/api/iconset/{:iconset}']['patch']['requestBody']['content']['application/json'];

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
    static async list(opts: BaseInterface_ListOptions = {}): Promise<DBIconset[]> {
        const cache = await this.hydrated();

        if (!cache || opts.sync) {
            await this.sync();
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

    static async get(uid: string): Promise<Iconset> {
        const token = await getRuntimeToken();
        const res = await server.GET('/api/iconset/{:iconset}', {
            params: {
                path: {
                    ':iconset': uid,
                }
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to fetch iconset');

        await db.iconset.put(res.data as DBIconset);

        return res.data;
    }

    static async create(body: Iconset_Create): Promise<Iconset> {
        const token = await getRuntimeToken();
        const res = await server.POST('/api/iconset', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to create iconset');

        await db.iconset.put(res.data as DBIconset);

        return res.data;
    }

    static async update(uid: string, body: Iconset_Update): Promise<void> {
        const token = await getRuntimeToken();
        const res = await server.PATCH('/api/iconset/{:iconset}', {
            params: {
                path: {
                    ':iconset': uid,
                }
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to update iconset');

        await db.iconset.put(res.data as DBIconset);
    }

    static async regenerate(uid: string): Promise<void> {
        const token = await getRuntimeToken();
        const res = await server.POST('/api/iconset/{:iconset}/regen', {
            params: {
                path: {
                    ':iconset': uid,
                }
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (res.error) throw new Error(res.error.message);
    }

    static async download(uid: string): Promise<void> {
        await downloadUrl(`/api/iconset/${encodeURIComponent(uid)}?format=zip&download=true`, {
            filename: `${uid}.zip`,
            token: true
        });
    }

    static async sync(): Promise<void> {
        const token = await getRuntimeToken();
        const res = await server.GET('/api/iconset', {
            params: {
                query: {
                    limit: 0,
                    page: 0,
                    order: 'asc',
                    sort: 'name',
                    filter: ''
                }
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to sync iconsets');

        const list = res.data as IconsetList;

        await db.transaction('rw', db.iconset, db.cache, async () => {
            await db.iconset.clear();

            if (list.items.length) {
                await db.iconset.bulkPut(list.items);
            }

            await db.cache.put({
                key: this.listCacheKey,
                updated: Date.now()
            });
        });
    }

    static async delete(uid: string, opts: Iconset_DeleteOptions = {}): Promise<void> {
        if (!opts.localOnly) {
            const token = await getRuntimeToken();
            const { error } = await server.DELETE('/api/iconset/{:iconset}', {
                params: {
                    path: {
                        ':iconset': uid,
                    }
                },
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });

            if (error) throw new Error(error.message);
        }

        const cached = await db.iconset.get(uid);
        if (!cached) return;

        await db.transaction('rw', db.icon, db.iconset, async () => {
            await db.icon.where('iconset').equals(uid).delete();
            await db.iconset.delete(uid);
        });
    }
};
