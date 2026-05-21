import { db } from '../database.ts';
import { liveQuery, type Observable } from 'dexie';
import type { Contact } from '../types.ts';
import { std, stdurl } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions
} from './interface.ts';

export type Contact_ListOptions = BaseInterface_ListOptions & {
    token?: string;
    filter?: string;
};

export default class ContactManager extends BaseInterface {
    static readonly listCacheKey = 'contact';

    static async count(): Promise<number> {
        return await db.contact.count();
    }

    static liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.contact.count();
        });
    }

    static liveList(): Observable<Contact[]> {
        return liveQuery(async () => {
            return await db.contact.toArray();
        });
    }

    static async list<Contact>(opts: Contact_ListOptions = {}): Promise<Contact[]> {
        const cache = await db.cache.get(this.listCacheKey);

        if (!cache || opts.sync) {
            await this.sync(opts.token);
        }

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

    static async getByCallsign(callsign: string): Promise<Contact | undefined> {
        return await db.contact.where('callsign').equals(callsign).first();
    }

    static async put(contact: Contact): Promise<void> {
        await db.contact.put(contact);
    }

    static async sync(token?: string): Promise<void> {
        const url = stdurl('/api/marti/api/contacts/all');

        const res = await std(url, { token }) as Contact[];

        await db.contact.clear();
        await db.contact.bulkPut(res);
        await db.cache.put({
            key: this.listCacheKey,
            updated: Date.now()
        });
    }
}
