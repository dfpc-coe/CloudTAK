import { db } from './database.ts';

export default class Icon {
    async has(icon: string): Promise<boolean> {
        return await db.icon
            .where("name")
            .equals(icon)
            .count() > 0;
    }

    async populate(icons: string[]): Promise<void> {
        await db.icon.bulkPut(
            icons.map((name) => ({ name })),
        );
    }
}
