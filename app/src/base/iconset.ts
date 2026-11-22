import type { Observable } from 'dexie';
import { db, type DBIconset, liveQuery } from '../database.ts';
import type { paths } from '@cloudtak/api-types';
import type { Iconset, IconsetList } from '../types.ts';
import { downloadUrl, server } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

export type Iconset_DeleteOptions = {
    localOnly?: boolean;
};

export type Iconset_ListOptions = BaseInterface_ListOptions & {
    filter?: string;
    limit?: number;
    page?: number;
};

export default class IconsetManager extends BaseInterface {
    static readonly listCacheKey = 'iconset';

    /**
     * Return all locally cached iconsets ordered by name.
     */
    static async list(opts: Iconset_ListOptions = {}): Promise<DBIconset[]> {
        const cache = await this.hydrated();

        if (!cache || opts.sync) {
            await this.sync();
        }

        let collection = db.iconset.orderBy('name');
        const filter = opts.filter?.trim().toLowerCase();

        if (filter) {
            collection = collection.filter((iconset) => {
                return iconset.name.toLowerCase().includes(filter)
                    || iconset.uid.toLowerCase().includes(filter)
                    || (iconset.username || '').toLowerCase().includes(filter);
            });
        }

        if (opts.limit !== undefined) {
            collection = collection
                .offset((opts.page ?? 0) * opts.limit)
                .limit(opts.limit);
        }

        return await collection.toArray();
    }

    static liveList(opts: Iconset_ListOptions = {}): Observable<DBIconset[]> {
        return liveQuery(async () => {
            return await this.list(opts);
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

    /** Write a server row, keeping the icon sync marker set by base/icon.ts */
    static async put(remote: Iconset): Promise<void> {
        const cached = await db.iconset.get(remote.uid);
        await db.iconset.put({ ...cached, ...remote });
    }

    static async get(uid: string): Promise<Iconset> {
        const res = await server.GET('/api/iconset/{:iconset}', {
            params: {
                path: {
                    ':iconset': uid,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to fetch iconset');

        await this.put(res.data);

        return res.data;
    }

    static async generate(
        body: paths['/api/iconset']['post']['requestBody']['content']['application/json']
    ): Promise<Iconset> {
        const res = await server.POST('/api/iconset', {
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to create iconset');

        await this.put(res.data);

        return res.data;
    }

    static async update(
        uid: string,
        body: paths['/api/iconset/{:iconset}']['patch']['requestBody']['content']['application/json']
    ): Promise<void> {
        const res = await server.PATCH('/api/iconset/{:iconset}', {
            params: {
                path: {
                    ':iconset': uid,
                }
            },
            body
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to update iconset');

        await this.put(res.data);
    }

    static async regenerate(uid: string): Promise<void> {
        const res = await server.POST('/api/iconset/{:iconset}/regen', {
            params: {
                path: {
                    ':iconset': uid,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
    }

    /** `tak` converts every icon to PNG for TAK clients, `cloudtak` keeps the original files including SVGs */
    static async download(uid: string, variant: 'tak' | 'cloudtak' = 'tak'): Promise<void> {
        await downloadUrl(`/api/iconset/${encodeURIComponent(uid)}?format=zip&variant=${variant}&download=true`, {
            filename: `${uid}.zip`,
            token: true
        });
    }

    static async sync(): Promise<void> {
        const res = await server.GET('/api/iconset', {
            params: {
                query: {
                    limit: 0,
                    page: 0,
                    order: 'asc',
                    sort: 'name',
                    filter: ''
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        if (!res.data) throw new Error('Failed to sync iconsets');

        const list = res.data as IconsetList;

        await db.transaction('rw', db.iconset, db.cache, async () => {
            const cached = new Map((await db.iconset.toArray()).map((iconset) => [iconset.uid, iconset]));
            await db.iconset.clear();

            if (list.items.length) {
                await db.iconset.bulkPut(list.items.map((item) => ({ ...cached.get(item.uid), ...item })));
            }

            await db.cache.put({
                key: this.listCacheKey,
                updated: Date.now()
            });
        });
    }

    static async delete(uid: string, opts: Iconset_DeleteOptions = {}): Promise<void> {
        if (!opts.localOnly) {
            const { error, response } = await server.DELETE('/api/iconset/{:iconset}', {
                params: {
                    path: {
                        ':iconset': uid,
                    }
                }
            });

            if (error && response.status !== 404) throw new Error(error.message);
        }

        const cached = await db.iconset.get(uid);
        if (!cached) return;

        await db.transaction('rw', db.icon, db.iconset, async () => {
            await db.icon.where('iconset').equals(uid).delete();
            await db.iconset.delete(uid);
        });
    }
};
