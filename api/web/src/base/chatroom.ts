import { db } from './database.ts'
import { std, stdurl } from '../std.ts';
import type {
    ProfileChatroomList
} from '../types.ts';

/**
 * High Level Wrapper around the Profile Chatroom API
 *
 * @property {string} guid - The unique identifier for the mission
 * @property {string} name - The name of the mission
 * @property {Mission} meta - The mission metadata
 * @property {MissionRole} role - The role of the user in the mission
 * @property {string} token - The CloudTAK Authentication token for API calls
 * @property {string} [missiontoken] - The mission token for authentication
 *
 * @property {boolean} subscribed - Whether the user is subscribed to the mission
 */
export default class Chatroom {
    name: string;

    constructor(
        name: string
    ) {
        this.name = mission.name;
    }

    /**
     * Return a Chatroom instance if one already exists in the local DB,
     */
    static async from(
        id: string,
    ): Promise<Subscription | undefined> {
        const exists = await db.chatroom
            .get(id)

        if (!exists) {
            return;
        }

        return new Chatroom(
            exists.name,
        );
    }

    /**
     * Loads an existing Chatroom from the local DB and refresh it,
     *
     * @param id - The unique identifier for the mission
     * @param opts - Options for loading the subscription
     * @param opts.reload - Whether to reload the mission from the local DB
     */
    static async load(
        id: string,
        opts: {
            reload?: boolean,
        }
    ): Promise<ProfileChatroomList> {
        const exists = await this.from(id);

        if (exists) {
            if (opts.reload !== false) {
                await exists.refresh({
                    refresh: true
                });
            }

            return exists;
        } else {
            const url = stdurl('/api/profile/chat/' + encodeURIComponent(id));

            const chatroom = await std(url, {
                token: opts.token
            }) as ProfileChatroomList;

            const room = new Chatroom(
                chatroom.name
            );

            await db.subscription.put({

            });

            await sub.refresh();

            return sub;
        }
    }

    async update(
        body: {
            dirty?: boolean,
            subscribed?: boolean,
            token?: string,
            description?: string
        }
    ): Promise<void> {
        if (body.subscribed !== undefined) {
            this.subscribed = body.subscribed;
        }

        if (body.dirty !== undefined) {
            this.dirty = body.dirty;
        }

        if (body.token !== undefined) {
            this.token = body.token;
        }

        if (body.description !== undefined) {
            this.meta.description = body.description;
        }

        await db.subscription.update(this.guid, {
            dirty: this.dirty,
            subscribed: this.subscribed,
            token: this.token
        });

        if (body.description !== undefined) {
            const url = stdurl(`/api/marti/missions/${this.guid}`);
            this.meta = await std(url, {
                method: 'PATCH',
                headers: Subscription.headers(this.missiontoken),
                token: this.token,
                body: {
                    description: body.description
                }
            }) as Mission;

            await db.subscription.update(this.guid, {
                meta: JSON.parse(JSON.stringify(this.meta)),
            });
        }

        this._sync.postMessage({
            guid: this.guid,
            type: SubscriptionEventType.UPDATE,
            state: {
                dirty: this.dirty,
                subscribed: this.subscribed,
            }
        });
    }

    async delete(): Promise<void> {
        const url = stdurl(`/api/marti/missions/${this.guid}`);
        const list = await std(url, {
            method: 'DELETE',
            headers: Subscription.headers(this.missiontoken),
            token: this.token
        }) as { data: Array<unknown> };

        if (list.data.length !== 1) throw new Error('Mission Error');

        await db.subscription.delete(this.meta.guid);

        this._sync.postMessage({
            guid: this.guid,
            type: SubscriptionEventType.DELETE,
            state: {
                dirty: this.dirty,
                subscribed: this.subscribed,
            }
        });
    }

    headers(): Record<string, string> {
        return Subscription.headers(this.missiontoken);
    }

    /**
     * Reload the Mission from the local Database
     */
    async reload(): Promise<void> {
        const exists = await db.subscription
            .get(this.guid)

        if (exists) {
            this.meta = exists.meta;
            this.role = exists.role;
            this.missiontoken = exists.token;
            this.subscribed = exists.subscribed;
        }
    };

    /**
     * Perform a hard refresh of the Chatroom from the Server
     */
    async refresh(): Promise<void> {
        await this.fetch();
    };

    async fetch(): Promise<void> {
        const url = stdurl('/api/profile/chat/' + encodeURIComponent(this.id));

        const chatroom = await std(url, {
            token: this.token
        }) as ProfileChatroomList;
        
        this.name = chatroom.name;

    }

    /**
     * List all locally stored missions, with optional filtering
     *
     * @param filter - Filter options for the local mission list
     * @param filter.role - Filter by minimum role
     * @param filter.subscribed - Filter by subscription status
     * @param filter.dirty - Filter by dirty status
     */
    static async localList(
        filter?: {
            role?: 'MISSION_OWNER' | 'MISSION_SUBSCRIBER' | 'MISSION_READONLY_SUBSCRIBER',
            subscribed?: boolean,
            dirty?: boolean
        }
    ): Promise<Set<{
        guid: string;
        name: string;
    }>> {
        let collection = db.subscription.toCollection();

        if (filter?.subscribed !== undefined) {
            collection = collection.filter((sub) => sub.subscribed === filter.subscribed);
        }

        if (filter?.dirty !== undefined) {
            collection = collection.filter((sub) => sub.dirty === filter.dirty);
        }

        if (filter?.role !== undefined) {
            collection = collection.filter((sub) => {
                if (!sub.role) return false;

                if (filter.role === 'MISSION_OWNER') {
                    return sub.role.type === 'MISSION_OWNER'
                } else if (filter.role === 'MISSION_SUBSCRIBER') {
                    return sub.role.type === 'MISSION_OWNER' || sub.role.type === 'MISSION_SUBSCRIBER'
                } else {
                    return true;
                }
            });
        }


        const list = await collection
        .sortBy('name');

        const guids = new Set<{
            guid: string;
            name: string;
        }>();

        for (const sub of list) {
            guids.add({
                name: sub.name,
                guid: sub.guid
            });
        }

        return guids;
    }

    static async list(): Promise<ProfileChatroomList> {
        if (opts.passwordProtected === undefined) opts.passwordProtected = true;
        if (opts.defaultRole === undefined) opts.defaultRole = true;

        const url = stdurl('/api/profile/chat');

        return await std(url) as ProfileChatroomList;
    }

}
