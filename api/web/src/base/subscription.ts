import { db } from './database.ts'
import { std, stdurl } from '../std.ts';
import SubscriptionLog from './subscription-log.ts';
import SubscriptionFeature from './subscription-feature.ts';
import type {
    Mission,
    MissionRole,
    MissionList,
    MissionLayer,
    MissionChanges,
    MissionLayerList,
    MissionLayer_Create,
    MissionLayer_Update,
    MissionSubscriptions
} from '../types.ts';

export enum SubscriptionEventType {
    CREATE = 'subscription::create',
    UPDATE = 'subscription::update',
    DELETE = 'subscription::delete'
}

export type SubscriptionEvent = {
    guid: string;
    type: SubscriptionEventType;
    state: {
        dirty: boolean;
        subscribed: boolean;
    }
}

/**
 * High Level Wrapper around the Data/Mission Sync API
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
export default class Subscription {
    guid: string;
    name: string;

    meta: Mission;
    role: MissionRole;

    log: SubscriptionLog;
    feature: SubscriptionFeature;

    token: string;
    missiontoken?: string;

    dirty: boolean;
    subscribed: boolean;

    _sync: BroadcastChannel

    constructor(
        mission: Mission,
        role: MissionRole,
        opts: {
            subscribed: boolean,
            token: string,
            missiontoken?: string,
        }
    ) {
        this._sync = new BroadcastChannel('subscription');

        this._sync.onmessage = async (ev: MessageEvent<SubscriptionEvent>) => {
            if (ev.data.guid === this.guid) {
                await this.reload();
            }
        };

        this.log = new SubscriptionLog(mission.guid, {
            missiontoken: opts.missiontoken,
            token: opts.token
        });

        this.feature = new SubscriptionFeature(this, {
            missiontoken: opts.missiontoken,
            token: opts.token
        });

        this.subscribed = opts.subscribed;

        this.guid = mission.guid;
        this.name = mission.name;
        this.meta = mission;
        this.role = role;

        this.token = opts.token;

        if (opts?.missiontoken) this.missiontoken = opts.missiontoken;

        this.dirty = false;
    }

    /**
     * Return a Subscription instance of one already exists in the local DB,
     */
    static async from(
        guid: string,
        token: string,
        opts?: {
            subscribed?: boolean
        }
    ): Promise<Subscription | undefined> {
        const exists = await db.subscription
        .get(guid)

        if (!exists || (opts?.subscribed !== undefined && exists.subscribed !== opts.subscribed)) {
            return;
        }

        return new Subscription(
            exists.meta,
            exists.role,
            {
                token: token,
                missiontoken: exists.token,
                subscribed: opts?.subscribed !== undefined ? opts.subscribed : exists.subscribed,
            }
        );
    }

    /**
     * Loads an existing Subscription from the local DB, or obtains it from the server
     */
    static async load(
        guid: string,
        opts: {
            token: string
            missiontoken?: string,
            subscribed?: boolean
        }
    ): Promise<Subscription> {
        const exists = await this.from(guid, opts.token);

        if (exists) {
            await exists.refresh();
            return exists;
        } else {
            if (!opts.subscribed) opts.subscribed = false;

            const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid));

            const mission = await std(url, {
                headers: Subscription.headers(opts.missiontoken),
                token: opts.token
            }) as Mission;

            const role = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/role', {
                headers: Subscription.headers(opts.missiontoken),
                token: opts.token
            }) as MissionRole;

            const sub = new Subscription(
                mission,
                role,
                {
                    subscribed: false,
                    ...opts
                }
            );

            await db.subscription.put({
                guid: sub.meta.guid,
                name: sub.meta.name,
                dirty: sub.dirty,
                subscribed: sub.subscribed,
                meta: sub.meta,
                role: sub.role,
                token: opts.missiontoken || ''
            });

            await sub.refresh();

            return sub;
        }
    }

    async update(
        body: {
            dirty?: boolean,
            subscribed?: boolean
        }
    ): Promise<void> {
        if (body.subscribed !== undefined) {
            this.subscribed = body.subscribed;
        }

        if (body.dirty !== undefined) {
            this.dirty = body.dirty;
        }

        await db.subscription.update(this.guid, {
            dirty: this.dirty,
            subscribed: this.subscribed
        });

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
     * Perform a hard refresh of the Mission from the Server
     */
    async refresh(opts?: {
        refreshMission?: boolean
    }): Promise<void> {
        if (opts?.refreshMission) {
            await this.fetch();
        }

        await Promise.all([
            this.log.refresh(),
            this.feature.refresh(),
        ]);
    };

    async fetch(): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid));

        this.meta = await std(url, {
            headers: Subscription.headers(this.missiontoken),
            token: this.token
        }) as Mission;
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

    static async list(opts: {
        passwordProtected?: boolean;
        defaultRole?: boolean;
    } = {}): Promise<MissionList> {
        if (opts.passwordProtected === undefined) opts.passwordProtected = true;
        if (opts.defaultRole === undefined) opts.defaultRole = true;

        const url = stdurl('/api/marti/mission');
        url.searchParams.append('passwordProtected', String(opts.passwordProtected));
        url.searchParams.append('defaultRole', String(opts.defaultRole));
        return await std(url) as MissionList;
    }

    static headers(token?: string): Record<string, string> {
        const headers: Record<string, string> = {};
        if (token) headers.MissionAuthorization = token;
        return headers;
    }

    async subscriptions(): Promise<MissionSubscriptions> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(this.guid)}/subscriptions/roles`);

        const res = await std(url, {
            method: 'GET',
            token: this.token,
            headers: Subscription.headers(this.missiontoken)
        }) as {
            data: MissionSubscriptions
        };

        return res.data
    }

    async changes(): Promise<MissionChanges> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/changes');

        return await std(url, {
            method: 'GET',
            token: this.token,
            headers: Subscription.headers(this.missiontoken)
        }) as MissionChanges;
    }

    async layerList(): Promise<MissionLayerList> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(this.guid)}/layer`);

        const list = await std(url, {
            method: 'GET',
            token: this.token,
            headers: Subscription.headers(this.missiontoken)
        }) as MissionLayerList;

        list.data.sort((a, b) => {
            // Consistent sort by name
            return a.name.localeCompare(b.name);
        });

        return list;
    }

    async layerUpdate(
        guid: string,
        layerid: string,
        layer: MissionLayer_Update
    ): Promise<MissionLayer> {
        const url = stdurl(`/api/marti/missions/${this.guid}/layer/${layerid}`);

        return await std(url, {
            method: 'PATCH',
            body: layer,
            token: this.token,
            headers: Subscription.headers(this.missiontoken)
        }) as MissionLayer;
    }

    async layerCreate(
        layer: MissionLayer_Create
    ): Promise<MissionLayer> {
        const url = stdurl(`/api/marti/missions/${this.guid}/layer`);

        return await std(url, {
            method: 'POST',
            body: layer,
            token: this.token,
            headers: Subscription.headers(this.missiontoken)
        }) as MissionLayer;
    }

    async layerDelete(
        layeruid: string
    ): Promise<void> {
        const url = stdurl(`/api/marti/missions/${this.guid}/layer/${layeruid}`);
        await std(url, {
            method: 'DELETE',
            token: this.token,
            headers: Subscription.headers(this.missiontoken)
        })
    }
}
