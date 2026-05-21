import { db, type DBIconset } from './database.ts';

export default class Iconset extends BaseInterface {
    /**
     * Return all locally cached iconsets ordered by name.
     */
    static async list(): Promise<DBIconset[]> {
        return await db.iconset.orderBy('name').toArray();
    }

    static async get(uid: string): Promise<DBIconset | undefined> {
        return await db.iconset.get(uid);
    }
}
