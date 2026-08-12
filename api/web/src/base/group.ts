import { db } from '../database.ts';
import { liveQuery, type Observable } from 'dexie';
import { server } from '../std.ts';
import type { Group, GroupChannel } from '../types.ts';
import BaseInterface from './interface.ts';
import type {
    BaseInterface_ListOptions,
    BaseInterface_FromOptions
} from './interface.ts';

export type Group_ListOptions = BaseInterface_ListOptions & {
    active?: boolean;
    direction?: string;
};

export default class GroupManager extends BaseInterface {
    static readonly listCacheKey = 'group';

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

    static async count(opts: Omit<Group_ListOptions, 'sync'> = {}): Promise<number> {
        return (await this.query(opts)).length;
    }

    static liveCount(opts: Omit<Group_ListOptions, 'sync'> = {}): Observable<number> {
        return liveQuery(async () => {
            return await this.count(opts);
        });
    }

    static liveList(opts: Group_ListOptions = {}): Observable<GroupChannel[]> {
        return liveQuery(async () => {
            return await this.list(opts);
        });
    }

    static async list(opts: Group_ListOptions = {}): Promise<GroupChannel[]> {
        const cache = await this.hydrated();

        if (!cache || opts.sync) {
            await this.sync();
        }

        return await this.query(opts);
    }

    /**
     * Get a single GroupChannel by name.
     */
    static async from(
        name: string,
        opts?: BaseInterface_FromOptions
    ): Promise<GroupChannel | undefined> {
        if (opts?.sync) {
            await this.sync();
        }

        return await db.group.get(name);
    }

    static liveFrom(name: string): Observable<GroupChannel | undefined> {
        return liveQuery(async () => {
            return await db.group.get(name);
        });
    }

    /**
     * Put one or more GroupChannels into the database.
     */
    static async put(channels: GroupChannel[] | GroupChannel): Promise<void> {
        if (!Array.isArray(channels)) channels = [channels];
        await db.group.bulkPut(channels);
    }

    static async sync(): Promise<void> {
        const { data, error } = await server.GET('/api/marti/group', {
            params: { query: { useCache: true } }
        });

        if (error || !data) throw new Error('Failed to sync groups');

        await this.cache(GroupManager.merge(data.data as Group[]));
    }

    /**
     * Replace the user's full channel set via the API.
     *
     * The Marti endpoint is a bulk PUT of every channel, so this cannot be
     * expressed as BaseInterface.update(id, data) - it is a whole-collection
     * write rather than a single-item update.
     */
    static async updateAll(channels: GroupChannel[]): Promise<GroupChannel[]> {
        // Explode merged channels back to individual direction entries for the API
        const apiGroups = GroupManager.explode(channels);

        const { error } = await server.PUT('/api/marti/group', {
            body: apiGroups
        });

        if (error) throw new Error('Failed to update groups');

        await this.cache(channels);

        return channels;
    }

    private static async cache(channels: GroupChannel[]): Promise<void> {
        await db.group.clear();
        await db.group.bulkPut(channels);
        await db.cache.put({ key: this.listCacheKey, updated: Date.now() });
    }

    private static async query(opts: Omit<Group_ListOptions, 'sync'> = {}): Promise<GroupChannel[]> {
        let collection = db.group.toCollection();

        if (opts.active !== undefined) {
            collection = collection.filter((g) => g.active === opts.active);
        }

        if (opts.direction !== undefined) {
            collection = collection.filter((g) => g.direction.includes(opts.direction as string));
        }

        return await collection.toArray();
    }
}

