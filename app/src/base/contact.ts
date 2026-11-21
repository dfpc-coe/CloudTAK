import { db, liveQuery } from '../database.ts';
import type { Observable } from 'dexie';
import type { ContactRecord } from '../types.ts';
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

/** How long a contact that is no longer online stays listed as recently offline */
export const CONTACT_RECENT_MS = 60 * 60 * 1000;

/** Minimum gap between `lastSeen` writes for one contact, so position reports don't each hit IndexedDB */
export const CONTACT_TOUCH_INTERVAL_MS = 60 * 1000;

export default class ContactManager extends BaseInterface {
    static readonly listCacheKey = 'contact';

    static async count(): Promise<number> {
        return await db.contact.count();
    }

    /**
     * True when the contact was seen within the recent window.
     * Rows without a `lastSeen` (stored before it existed) are not recent.
     */
    static isRecent(contact: ContactRecord, now: number = Date.now()): boolean {
        return !!contact.lastSeen && now - contact.lastSeen < CONTACT_RECENT_MS;
    }

    static liveList(): Observable<ContactRecord[]> {
        return liveQuery(async () => {
            return await db.contact.toArray();
        });
    }

    static async list(opts: Contact_ListOptions = {}): Promise<ContactRecord[]> {
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
    ): Promise<ContactRecord | undefined> {
        if (opts?.sync) {
            await this.sync();
        }

        return await db.contact.get(uid);
    }

    static liveFrom(uid: string): Observable<ContactRecord | undefined> {
        return liveQuery(async () => {
            return await db.contact.get(uid);
        });
    }

    static async getByCallsign(callsign: string): Promise<ContactRecord | undefined> {
        return await db.contact.where('callsign').equals(callsign).first();
    }

    static async put(contact: ContactRecord): Promise<void> {
        await db.contact.put(contact);
    }

    /**
     * Record that the contact was just seen. Skipped when the stored stamp is
     * newer than CONTACT_TOUCH_INTERVAL_MS, so frequent position reports cost
     * one write a minute at most.
     */
    static async touch(contact: ContactRecord, now: number = Date.now()): Promise<void> {
        if (contact.lastSeen && now - contact.lastSeen < CONTACT_TOUCH_INTERVAL_MS) return;
        await db.contact.update(contact.uid, { lastSeen: now });
    }

    /**
     * Delete contacts that are neither online nor seen within CONTACT_RECENT_MS.
     * `online` holds the UIDs with a live marker; they are always kept.
     * Returns the number of rows deleted.
     */
    static async prune(online: Set<string>, now: number = Date.now()): Promise<number> {
        return await db.contact
            .filter((c) => !online.has(c.uid) && !this.isRecent(c, now))
            .delete();
    }

    static async sync(selfUid?: string): Promise<void> {
        const res = await server.GET('/api/marti/api/contacts/all');

        if (res.error) throw new Error(res.error.message);

        // Only update contacts already present in db.contact — those that arrived
        // via live CoT skittle markers. Never add contacts solely because the TAK
        // server lists them: that would admit machine users, ETL connections, and
        // the current user, none of which should appear as human contacts. This
        // mirrors exactly what happens on page load, where the contact list is
        // populated only from CoT presence markers.
        // bulkPut replaces the whole row, so carry the local-only lastSeen over.
        await db.transaction('rw', db.contact, db.cache, async () => {
            const existing = new Map(
                (await db.contact.toArray()).map((c) => [c.uid, c])
            );
            const contacts: ContactRecord[] = [];
            for (const c of res.data) {
                if (selfUid && c.uid === selfUid) continue;
                const row = existing.get(c.uid);
                if (!row) continue;
                contacts.push({ ...c, lastSeen: row.lastSeen });
            }
            if (contacts.length > 0) {
                await db.contact.bulkPut(contacts);
            }
            await db.cache.put({
                key: this.listCacheKey,
                updated: Date.now()
            });
        });
    }
}
