import { db } from '../database.ts';
import { liveQuery, type Observable } from 'dexie';
import type { Contact } from '../types.ts';
import { std, stdurl } from '../std.ts';
import type { BaseInterface } from './interface.ts';

type ContactInterface = BaseInterface<Contact> & {
    get(uid: string): Promise<Contact | undefined>;
    getByCallsign(callsign: string): Promise<Contact | undefined>;
    put(contact: Contact): Promise<void>;
    sync(token?: string): Promise<Contact[]>;
};

const ContactManager: ContactInterface = {
    async count(): Promise<number> {
        return await db.contact.count();
    },

    liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.contact.count();
        });
    },

    liveList(): Observable<Contact[]> {
        return liveQuery(async () => {
            return await db.contact.toArray();
        });
    },

    async list(opts: {
        token?: string;
        filter?: string;
    } = {}): Promise<Contact[]> {
        const cache = await db.cache.get('contact');

        if (!cache) {
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
    },

    async get(uid: string): Promise<Contact | undefined> {
        return await db.contact.get(uid);
    },

    async getByCallsign(callsign: string): Promise<Contact | undefined> {
        return await db.contact.where('callsign').equals(callsign).first();
    },

    async put(contact: Contact): Promise<void> {
        await db.contact.put(contact);
    },

    async sync(token?: string): Promise<Contact[]> {
        const url = stdurl('/api/marti/api/contacts/all');

        const res = await std(url, { token }) as Contact[];

        await db.contact.clear();
        await db.contact.bulkPut(res);
        await db.cache.put({ key: 'contact', updated: Date.now() });

        return res;
    }
};

export default ContactManager;
