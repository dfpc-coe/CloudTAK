import { liveQuery, type Observable } from 'dexie';
import { db, type DBProfileFile } from '../database.ts';
import BaseInterface from './interface.ts';
import type { BaseInterface_ListOptions } from './interface.ts';

export type ProfileFile_ListOptions = BaseInterface_ListOptions & {
    filter?: string;
};

/**
 * Metadata for profile assets whose PMTiles archive has been downloaded to
 * this device, so the Files menu can list them without the server
 */
export default class ProfileFileManager extends BaseInterface {
    static readonly listCacheKey = 'profile_file';

    static async count(): Promise<number> {
        return await db.profile_file.count();
    }

    static liveCount(): Observable<number> {
        return liveQuery(async () => {
            return await db.profile_file.count();
        });
    }

    static async list(opts: ProfileFile_ListOptions = {}): Promise<DBProfileFile[]> {
        let collection = db.profile_file.orderBy('name');
        const filter = opts.filter?.trim().toLowerCase();

        if (filter) {
            collection = collection.filter((file) => file.name.toLowerCase().includes(filter));
        }

        return await collection.toArray();
    }

    static liveList(opts: ProfileFile_ListOptions = {}): Observable<DBProfileFile[]> {
        return liveQuery(async () => {
            return await this.list(opts);
        });
    }

    static async from(id: string): Promise<DBProfileFile | undefined> {
        return await db.profile_file.get(id);
    }

    static liveFrom(id: string): Observable<DBProfileFile | undefined> {
        return liveQuery(async () => {
            return await db.profile_file.get(id);
        });
    }

    static async generate(file: DBProfileFile): Promise<DBProfileFile> {
        await db.profile_file.put(file);
        return file;
    }

    static async bulkPut(files: DBProfileFile[]): Promise<void> {
        if (!files.length) return;
        await db.profile_file.bulkPut(files);
    }

    static async update(id: string, file: Partial<DBProfileFile>): Promise<void> {
        await db.profile_file.update(id, file);
    }

    static async delete(id: string): Promise<void> {
        await db.profile_file.delete(id);
    }
}
