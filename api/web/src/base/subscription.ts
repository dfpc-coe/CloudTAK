import { db } from './database.ts'
import COT, { OriginMode } from './cot.ts'
import { std, stdurl } from '../std.ts';
import { useMapStore } from '../stores/map.ts';
import { bbox } from '@turf/bbox';
import SubscriptionLog from './subscription-logs.ts';
import type Atlas from '../workers/atlas.ts';
import type { Feature } from '../types.ts';
import type {
    BBox,
    FeatureCollection
} from 'geojson'
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
 * @property {Map<string, COT>} cots - A map of COT features in the mission
 * @property {boolean} subscribed - Whether the user is subscribed to the mission
 */
export default class Subscription {
    guid: string;
    name: string;

    meta: Mission;
    role: MissionRole;

    log: SubscriptionLog;

    token: string;
    missiontoken?: string;

    cots: Map<string, COT>;

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

        this._sync.onmessage = async (ev: MessageEvent) => {
            if (ev.data.guid === this.guid) {
                await this.reload();
            }
        };

        this.log = new SubscriptionLog(mission.guid, {
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

        this.cots = new Map();
    }

    static async load(
        guid: string,
        opts: {
            token: string
            atlas?: Atlas,
            missiontoken?: string,
            subscribed?: boolean
        }
    ): Promise<Subscription> {
        const exists = await db.subscription
            .get(guid)

        if (exists) {
            return new Subscription(
                exists.meta,
                exists.role,
                {
                    token: opts.token,
                    missiontoken: exists.token,
                    subscribed: opts.subscribed !== undefined ? opts.subscribed : exists.subscribed,
                }
            );
        } else {
            const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid));

            if (!opts.subscribed) opts.subscribed = false;

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

            if (opts.atlas && opts.subscribed) {
                const fc = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/cot', {
                    headers: Subscription.headers(opts.missiontoken),
                    token: opts.token
                }) as FeatureCollection;

                for (const feat of fc.features) {
                    const cot = new COT(opts.atlas, feat as Feature, {
                        mode: OriginMode.MISSION,
                        mode_id: guid
                    });

                    sub.cots.set(String(cot.id), cot);
                }
            }

            await db.subscription.put({
                guid: sub.meta.guid,
                name: sub.meta.name,
                dirty: false,
                subscribed: opts.subscribed,
                meta: sub.meta,
                role: sub.role,
                token: opts.missiontoken || ''
            });

            await sub.log.refresh();

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
            subscribed: body.subscribed
        });

        this._sync.postMessage({
            guid: this.guid
        });
    }

    async collection(raw = false): Promise<FeatureCollection> {
        return {
            type: 'FeatureCollection',
            features: Array.from(this.cots.values()).map((f: COT) => {
                if (raw) {
                    return f.as_feature();
                } else {
                    return f.as_rendered();
                }
            })
        }
    }

    async bounds(): Promise<BBox> {
        return bbox(await this.collection());
    }

    async delete(): Promise<void> {
        const mapStore = useMapStore();

        await Subscription.delete(this.meta.guid, this.missiontoken);
        await mapStore.worker.db.subscriptionDelete(this.meta.guid);

        await db.subscription.delete(this.meta.guid);
    }

    /**
     * Upsert a feature into the mission.
     * This will udpate the feature in the local DB, submit it to the TAK Server and
     * mark the subscription as dirty for a re-render
     *
     * @param cot - The COT object to upsert
     * @param opts - Options for updating the feature
     * @param opts.skipNetwork - If true, the feature will not be updated on the server - IE in response to a Mission Change event
     */
    async updateFeature(
        atlas: Atlas,
        cot: COT,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        this.cots.set(String(cot.id), cot);

        this.dirty = true;

        const feat = cot.as_feature({
            clone: true
        });

        feat.properties.dest = [{
            mission: this.meta.name
        }];

        if (!opts.skipNetwork) {
            await atlas.conn.sendCOT(feat);
        }
    }

    /**
     * Delete a feature from the mission.
     *
     * @param uid - The unique ID of the feature to delete
     * @param opts - Options for deleting the feature
     * @param opts.skipNetwork - If true, the feature will not be deleted from the server - IE in response to a Mission Change event
     */
    async deleteFeature(
        atlas: Atlas,
        uid: string,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        this.cots.delete(uid);

        this.dirty = true;

        if (!opts.skipNetwork) {
            const url = stdurl(`/api/marti/missions/${this.meta.guid}/cot/${uid}`);
            await std(url, {
                method: 'DELETE',
                headers: Subscription.headers(this.missiontoken),
                token:  atlas.token
            })
        }
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
    async refresh(): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.meta.guid));

        const mission = await std(url, {
            headers: this.headers(),
            token: this.token
        }) as Mission;

        this.meta = mission;

        await this.log.refresh();
    };
    static async fetch(guid: string, token?: string, opts: {
        logs?: boolean
    } = {}): Promise<Mission> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid));
        if (opts.logs) url.searchParams.append('logs', 'true');

        return await std(url, {
            headers: Subscription.headers(token)
        }) as Mission;
    }

    static async delete(guid: string, token?: string): Promise<void> {
        const url = stdurl(`/api/marti/missions/${guid}`);
        const list = await std(url, {
            method: 'DELETE',
            headers: Subscription.headers(token)
        }) as { data: Array<unknown> };
        if (list.data.length !== 1) throw new Error('Mission Error');
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

    static async featList(
        guid: string,
        opts: {
            token?: string
            missionToken?: string
        } = {}
    ): Promise<FeatureCollection> {
        return await std('/api/marti/missions/' + encodeURIComponent(guid) + '/cot', {
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        }) as FeatureCollection;
    }

    static async changes(guid: string, opts: {
        token?: string,
        missionToken?: string
    } = {}): Promise<MissionChanges> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/changes');

        return await std(url, {
            method: 'GET',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        }) as MissionChanges;
    }

    static async layerList(
        guid: string,
        opts: {
            token?: string
            missionToken?: string
        } = {}
    ): Promise<MissionLayerList> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(guid)}/layer`);

        const list = await std(url, {
            method: 'GET',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        }) as MissionLayerList;

        list.data.sort((a, b) => {
            // Consistent sort by name
            return a.name.localeCompare(b.name);
        });

        return list;
    }

    static async layerUpdate(
        guid: string,
        layerid: string,
        layer: MissionLayer_Update,
        opts: {
            token?: string,
            missionToken?: string
        } = {}
    ): Promise<MissionLayer> {
         const url = stdurl(`/api/marti/missions/${guid}/layer/${layerid}`);

         return await std(url, {
             method: 'PATCH',
             body: layer,
             token: opts.token,
             headers: Subscription.headers(opts.missionToken)
         }) as MissionLayer;
    }

    static async layerCreate(
        guid: string,
        layer: MissionLayer_Create,
        opts: {
            token?: string,
            missionToken?: string
        } = {}
    ): Promise<MissionLayer> {
         const url = stdurl(`/api/marti/missions/${guid}/layer`);

         return await std(url, {
             method: 'POST',
             body: layer,
             token: opts.token,
             headers: Subscription.headers(opts.missionToken)
         }) as MissionLayer;
    }

    static async layerDelete(
        guid: string,
        layeruid: string,
        opts: {
            token?: string,
            missionToken?: string
        } = {}
    ): Promise<void> {
        const url = stdurl(`/api/marti/missions/${guid}/layer/${layeruid}`);
        await std(url, {
            method: 'DELETE',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        })
    }
}
