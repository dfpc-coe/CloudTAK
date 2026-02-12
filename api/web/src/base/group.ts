import { db } from './database.ts';
import { liveQuery, type Observable } from 'dexie';
import { std, stdurl } from '../std.ts';
import type { Group } from '../types.ts';

export default class GroupManager {
    static live(opts: {
        active?: boolean;
        direction?: string;
    } = {}): Observable<Group[]> {
        return liveQuery(async () => {
            return await GroupManager.list(opts);
        });
    }

    static async list(opts: {
        active?: boolean;
        direction?: string;
    } = {}): Promise<Group[]> {
        let collection = db.group.toCollection();

        if (opts.active !== undefined) {
            collection = collection.filter((g) => g.active === opts.active);
        }

        if (opts.direction !== undefined) {
            collection = collection.filter((g) => g.direction === opts.direction);
        }

        return await collection.toArray();
    }

    static async get(name: string): Promise<Group | undefined> {
        return await db.group.get(name);
    }

    static async put(groups: Group[] | Group): Promise<void> {
        if (!Array.isArray(groups)) groups = [groups];
        await db.group.bulkPut(groups);
    }

    static async sync(token?: string): Promise<Group[]> {
        const url = stdurl('/api/marti/group');
        url.searchParams.set('useCache', 'true');

        const res = await std(url, { token }) as { data: Group[] };

        const groups = res.data as Group[];

        await db.group.clear();
        await db.group.bulkPut(groups);
        await db.cache.put({ key: 'group', updated: Date.now() });

        return groups;
    }

    static async update(groups: Group[], token?: string): Promise<Group[]> {
        const url = stdurl('/api/marti/group');
        await std(url, {
            method: 'PUT',
            token,
            body: groups
        });

        const dbGroups = groups as Group[];
        await db.group.clear();
        await db.group.bulkPut(dbGroups);
        await db.cache.put({ key: 'group', updated: Date.now() });

        return dbGroups;
    }
}
