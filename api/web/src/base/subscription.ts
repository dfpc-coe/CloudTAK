import COT, { OriginMode } from './cot.ts'
import { std, stdurl } from '../std.ts';
import { useMapStore } from '../stores/map.ts';
import { bbox } from '@turf/bbox';
import type { DatabaseType } from '../base/database.ts';
import SubscriptionLog from './subscription-logs.ts';
import type { Remote } from 'comlink';
import type Atlas from '../workers/atlas.ts';
import type { Feature } from '../types.ts';
import type {
    BBox,
    FeatureCollection
} from 'geojson'
import type {
    Mission,
    MissionLog,
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
    _db: DatabaseType;

    guid: string;
    name: string;

    meta: Mission;
    role: MissionRole;

    log: SubscriptionLog;

    token: string;
    missiontoken?: string;

    cots: Map<string, COT>;

    _dirty: boolean;

    subscribed?: boolean;

    _remote: BroadcastChannel | null;
    _atlas: Atlas | Remote<Atlas>;

    constructor(
        atlas: Atlas | Remote<Atlas>,
        db: DatabaseType,
        mission: Mission,
        role: MissionRole,
        opts?: {
            token?: string,
            missiontoken?: string,
            subscribed: boolean,
            remote?: boolean
        }
    ) {
        this._db = db;
        this._atlas = atlas;
        this._remote = (opts && opts.remote === true) ? new BroadcastChannel('sync') : null

        this.log = new SubscriptionLog(db, mission.guid, opts.missiontoken, opts.token);

        this.subscribed = opts.subscribed;

        this.guid = mission.guid;
        this.name = mission.name;
        this.meta = mission;
        this.role = role;

        this.token = opts.token;

        if (opts?.missiontoken) this.missiontoken = opts.missiontoken;

        this._dirty = false;

        this.cots = new Map();
    }

    static async load(
        atlas: Atlas,
        db: DatabaseType,
        guid: string,
        opts: {
            token?: string
            missiontoken?: string,
            subscribed: boolean
        }
    ): Promise<Subscription> {
        const exists = await db.subscription
            .get(guid)

        if (exists) {
            // TODO Check for Subscription Differences

            return new Subscription(
                atlas,
                db,
                exists.meta,
                exists.role,
                {
                    token: opts.token,
                    missiontoken: exists.token,
                    subscribed: exists.subscribed
                }
            );
        } else {
            const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid));
            url.searchParams.append('logs', 'true');

            const mission = await std(url, {
                headers: Subscription.headers(opts.missiontoken),
                token: opts.token
            }) as Mission;

            const logs = mission.logs || [] as Array<MissionLog>;
            delete mission.logs;

            const role = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/role', {
                headers: Subscription.headers(opts.missiontoken),
                token: opts.token
            }) as MissionRole;

            const sub = new Subscription(
                atlas,
                db,
                mission,
                role,
                opts
            );

            if (opts.subscribed) {
                const fc = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/cot', {
                    headers: Subscription.headers(opts.missiontoken),
                    token: opts.token
                }) as FeatureCollection;

                for (const feat of fc.features) {
                    const cot = new COT(atlas, feat as Feature, {
                        mode: OriginMode.MISSION,
                        mode_id: guid
                    });

                    sub.cots.set(String(cot.id), cot);
                }
            }

            await db.transaction('rw',
                db.subscription,
                db.subscription_log,
                async () => {
                    await db.subscription.delete(guid);

                    await db.subscription.put({
                        guid: sub.meta.guid,
                        name: sub.meta.name,
                        subscribed: true,
                        meta: sub.meta,
                        role: sub.role,
                        token: opts.missiontoken || ''
                    });

                    await db.subscription_log.where('mission').equals(guid).delete();

                    for (const log of logs) {
                        await db.subscription_log.put({
                            id: log.id,
                            dtg: log.dtg,
                            created: log.created,
                            mission: sub.meta.guid,
                            content: log.content,
                            creatorUid: log.creatorUid,
                            contentHashes: log.contentHashes,
                            keywords: log.keywords
                        });
                    }
                }
            );

            return sub;
        }
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
        mapStore.worker.db.subscriptionDelete(this.meta.guid);
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
        cot: COT,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        this.cots.set(String(cot.id), cot);

        this._dirty = true;

        const feat = cot.as_feature({
            clone: true
        });

        feat.properties.dest = [{
            mission: this.meta.name
        }];

        if (!opts.skipNetwork) {
            await this._atlas.conn.sendCOT(feat);
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
        uid: string,
        opts: {
            skipNetwork?: boolean
        } = {}
    ): Promise<void> {
        if (this._remote) return;

        this.cots.delete(uid);

        this._dirty = true;

        const atlas = this._atlas as Atlas;

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

    async refresh(): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.meta.guid));
        url.searchParams.append('logs', 'true');

        const mission = await std(url, {
            headers: this.headers(),
            token: String(this._atlas.token)
        }) as Mission;

        // TODO
        //this.logs = mission.logs || [] as Array<MissionLog>;
        delete mission.logs;
        this.meta = mission;
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
