import { liveQuery, type Observable } from 'dexie';
import { db, type DBIconset } from '../database.ts';
import type { BaseInterface } from './interface.ts';

type IconsetInterface = BaseInterface<DBIconset> & {
    get(uid: string): Promise<DBIconset | undefined>;
};

const Iconset: IconsetInterface = {
    async count(): Promise<number> {
        return await db.iconset.count();
    },

    liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.iconset.count();
        });
    },

    /**
     * Return all locally cached iconsets ordered by name.
     */
    async list(): Promise<DBIconset[]> {
        return await db.iconset.orderBy('name').toArray();
    },

    liveList(): Observable<DBIconset[]> {
        return liveQuery(async () => {
            return await db.iconset.orderBy('name').toArray();
        });
    },

    async get(uid: string): Promise<DBIconset | undefined> {
        return await db.iconset.get(uid);
    }
};

export default Iconset;
