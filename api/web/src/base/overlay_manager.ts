import { db } from './database.ts'
import type { DBOverlay } from './database.ts';
import { std } from '../std.ts';
import type { ProfileOverlay, ProfileOverlayList, ProfileOverlay_Create } from '../types.ts';
import { liveQuery, type Subscription } from 'dexie';

export default class OverlayManager {
    id: number;
    value: DBOverlay;
    _sub?: Subscription;

    constructor(
        id: number,
        value: DBOverlay,
    ) {
        this.id = id;
        this.value = value;
    }

    subscribe(cb: (val: DBOverlay) => void): void {
        if (this._sub) return;

        this._sub = liveQuery(() => db.overlay.get(this.id)).subscribe((entry) => {
            if (entry) {
                this.value = entry;
                cb(entry);
            }
        });
    }

    subscribed(): boolean {
        return !!this._sub;
    }

    destroy(): void {
        if (this._sub) {
            this._sub.unsubscribe();
        }
    }

    static async get(id: number): Promise<OverlayManager | undefined> {
        const entry = await db.overlay.get(id);
        if (!entry) return undefined;
        return new OverlayManager(entry.id, entry);
    }
    
    static async list(): Promise<OverlayManager[]> {
        const entries = await db.overlay.toArray();
        return entries.map(entry => new OverlayManager(entry.id, entry));
    }

    static async fetch(): Promise<ProfileOverlayList> {
        return await std('/api/profile/overlay') as ProfileOverlayList;
    }

    async commit(value: Partial<DBOverlay>): Promise<void> {
        const updated = { ...this.value, ...value };
        await db.overlay.put(updated);
        this.value = updated;

        await std(`/api/profile/overlay/${this.id}`, {
            method: 'PATCH',
            body: value
        });
    }

    static async delete(id: number): Promise<void> {
        await std(`/api/profile/overlay?id=${id}`, {
            method: 'DELETE'
        });
        await db.overlay.delete(id);
    }

    static async create(body: ProfileOverlay_Create): Promise<OverlayManager> {
        const ov = await std('/api/profile/overlay', {
            method: 'POST',
            body
        }) as ProfileOverlay;

        const entry: DBOverlay = { ...ov, styles: ov.styles || [] };
        await db.overlay.put(entry);
        
        return new OverlayManager(entry.id, entry);
    }

    static async sync(opts: {
        refresh?: boolean
    }  = {}): Promise<void> {
        const count = await db.overlay.count();
        if (count > 0 && !opts.refresh) return;

        const fresh = await this.fetch();
        await this.saveAll(fresh.items);
    }

    static async saveAll(overlays: ProfileOverlay[]): Promise<void> {
        const entries: DBOverlay[] = overlays.map(o => ({
            ...o,
            styles: o.styles || []
        }));
        await db.overlay.bulkPut(entries);
    }
}
