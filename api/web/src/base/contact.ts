import { db } from '../database.ts';
import { liveQuery, type Observable } from 'dexie';
import type { Contact as TAKContact } from '../types.ts';
import { server } from '../std.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

export type Contact_ListOptions = BaseInterface_ListOptions & {
    filter?: string;
};

export type Contact_FromOptions = BaseInterface_FromOptions;

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

    static liveList(): Observable<TAKContact[]> {
        return liveQuery(async () => {
            return await db.contact.toArray();
        });
    }

    static async list(opts: Contact_ListOptions = {}): Promise<TAKContact[]> {
        const cache = await this.hydrated();

        if (!cache || opts.sync) {
            await this.sync();
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

    static async from(
        uid: string,
        opts?: Contact_FromOptions
    ): Promise<TAKContact | undefined> {
        if (opts?.sync) {
            await this.sync();
        }

        return await db.contact.get(uid);
    }

    static liveFrom(uid: string): Observable<TAKContact | undefined> {
        return liveQuery(async () => {
            return await db.contact.get(uid);
        });
    }

    static async getByCallsign(callsign: string): Promise<TAKContact | undefined> {
        return await db.contact.where('callsign').equals(callsign).first();
    }

    static async put(contact: TAKContact): Promise<void> {
        await db.contact.put(contact);
    }

    static async sync(): Promise<void> {
        const res = await server.GET('/api/marti/api/contacts/all');

        if (res.error) throw new Error(res.error.message);

        await db.contact.clear();
        await db.contact.bulkPut(res.data);
        await db.cache.put({
            key: this.listCacheKey,
            updated: Date.now()
        });
    }
}
