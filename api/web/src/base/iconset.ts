import { liveQuery, type Observable } from 'dexie';
import { db, type DBIconset } from '../database.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions
} from './interface.ts';

export type Iconset_ListOptions = BaseInterface_ListOptions;

export default class IconsetManager extends BaseInterface {
    static readonly listCacheKey = 'iconset';

    static async count(): Promise<number> {
        return await db.iconset.count();
    },

    static liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.iconset.count();
        });
    },

    /**
     * Return all locally cached iconsets ordered by name.
     */
    static async list(): Promise<DBIconset[]> {
        return await db.iconset.orderBy('name').toArray();
    },

    static liveList(): Observable<DBIconset[]> {
        return liveQuery(async () => {
            return await db.iconset.orderBy('name').toArray();
        });
    },

    static async get(uid: string): Promise<DBIconset | undefined> {
        return await db.iconset.get(uid);
    }
};
