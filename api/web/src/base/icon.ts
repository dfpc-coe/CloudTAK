import { db, type DBIcon } from './database.ts';

export default class Icon {
    static async has(icon: string): Promise<boolean> {
        return await db.icon
            .where("name")
            .equals(icon)
            .count() > 0;
    }

    static async get(icon: string): Promise<DBIcon | undefined> {
        return await db.icon.get(icon);
    }
}
