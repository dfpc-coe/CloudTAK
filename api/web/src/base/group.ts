import { db } from './database.ts';
import { liveQuery, type Observable } from 'dexie';
import { std, stdurl } from '../std.ts';
import type { Group, GroupChannel } from '../types.ts';

export default class GroupManager {
    /**
     * Merge an array of API Group entries (each with a single direction string)
     * into GroupChannel entries keyed by name with direction as a string array
     */
    static merge(groups: Group[]): GroupChannel[] {
        const map: Record<string, GroupChannel> = {};

        for (const group of groups) {
            if (map[group.name]) {
                if (!map[group.name].direction.includes(group.direction)) {
                    map[group.name].direction.push(group.direction);
                }
            } else {
                map[group.name] = {
                    ...group,
                    direction: [group.direction]
                };
            }
        }

        return Object.values(map);
    }

    /**
     * Explode a GroupChannel (with direction array) back into individual
     * API Group entries (each with a single direction string)
     */
    static explode(channels: GroupChannel[]): Group[] {
        const groups: Group[] = [];

        for (const channel of channels) {
            for (const dir of channel.direction) {
                groups.push({
                    ...channel,
                    direction: dir
                });
            }
        }

        return groups;
    }

    static live(opts: {
        active?: boolean;
        direction?: string;
    } = {}): Observable<GroupChannel[]> {
        return liveQuery(async () => {
            return await GroupManager.list(opts);
        });
    }

    static async list(opts: {
        token?: string;
        active?: boolean;
        direction?: string;
    } = {}): Promise<GroupChannel[]> {
        const cache = await db.cache.get('group');
        if (!cache) {
            await GroupManager.sync(opts.token);
        }

        let collection = db.group.toCollection();

        if (opts.active !== undefined) {
            collection = collection.filter((g) => g.active === opts.active);
        }

        if (opts.direction !== undefined) {
            collection = collection.filter((g) => g.direction.includes(opts.direction));
        }

        return await collection.toArray();
    }

    static async get(name: string): Promise<GroupChannel | undefined> {
        return await db.group.get(name);
    }

    static async put(channels: GroupChannel[] | GroupChannel): Promise<void> {
        if (!Array.isArray(channels)) channels = [channels];
        await db.group.bulkPut(channels);
    }

    static async sync(token?: string): Promise<GroupChannel[]> {
        const url = stdurl('/api/marti/group');
        url.searchParams.set('useCache', 'true');

        const res = await std(url, { token }) as { data: Group[] };

        const channels = GroupManager.merge(res.data);

        await db.group.clear();
        await db.group.bulkPut(channels);
        await db.cache.put({ key: 'group', updated: Date.now() });

        return channels;
    }

    static async update(channels: GroupChannel[], token?: string): Promise<GroupChannel[]> {
        const url = stdurl('/api/marti/group');

        // Explode merged channels back to individual direction entries for the API
        const apiGroups = GroupManager.explode(channels);

        await std(url, {
            method: 'PUT',
            token,
            body: apiGroups
        });

        await db.group.clear();
        await db.group.bulkPut(channels);
        await db.cache.put({ key: 'group', updated: Date.now() });

        return channels;
    }
}

