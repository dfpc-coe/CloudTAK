import { db } from './database.ts';
import type { Contact } from '../types.ts';
import { std, stdurl } from '../std.ts';

export default class ContactManager {
    static async list(opts: {
        filter?: string;
    } = {}): Promise<Contact[]> {
        let collection = db.contact.toCollection();

        if (opts.filter) {
            const filter = opts.filter.toLowerCase();
            collection = collection.filter((c) => {
                return c.callsign.toLowerCase().includes(filter);
            });
        }

        return await collection.toArray();
    }

    static async get(uid: string): Promise<Contact | undefined> {
        return await db.contact.get(uid);
    }

    static async put(contact: Contact): Promise<void> {
        await db.contact.put(contact);
    }

    static async sync(token?: string): Promise<Contact[]> {
        const url = stdurl('/api/marti/api/contacts/all');

        const res = await std(url, { token }) as Contact[];

        await db.contact.clear();
        await db.contact.bulkPut(res);
        await db.cache.put({ key: 'contact', updated: Date.now() });

        return res;
    }
}
