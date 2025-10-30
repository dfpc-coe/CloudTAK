import { db } from './database.ts';

export default class Icon {
    static async has(icon: string): Promise<boolean> {
        return await db.icon
            .where("name")
            .equals(icon)
            .count() > 0;
    }

    static async populate(icons: string[]): Promise<void> {
        await db.icon.bulkPut(
            icons.map((name) => ({ name })),
        );
    }
}
