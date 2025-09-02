import COT, { OriginMode } from './cot.ts'
import { std, stdurl } from '../std.ts';
import { useMapStore } from '../stores/map.ts';
import { bbox } from '@turf/bbox';
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
    MissionLogList,
    MissionLayerList,
    MissionLayer_Create,
    MissionLayer_Update,
    MissionSubscriptions
} from '../types.ts';

/**
 * High Level Wrapper around the Data/Mission Sync API
 */
export default class Subscription {
    meta: Mission;
    role: MissionRole;
    token?: string;
    logs: Array<MissionLog>;
    cots: Map<string, COT>;

    _dirty: boolean;

    _remote: BroadcastChannel | null;
    _atlas: Atlas | Remote<Atlas>;

    // Should features be automatically added
    auto: boolean;

    constructor(
        atlas: Atlas | Remote<Atlas>,
        mission: Mission,
        role: MissionRole,
        logs: Array<MissionLog>,
        opts?: {
            token?: string,
            remote?: boolean
        }
    ) {
        this._atlas = atlas;
        this._remote = (opts && opts.remote === true) ? new BroadcastChannel('sync') : null

        this.meta = mission;
        this.role = role;
        this.logs = logs;

        if (opts && opts.token) {
            this.token = opts.token;
        }

        this._dirty = false;

        this.cots = new Map();

        this.auto = false;
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

        await Subscription.delete(this.meta.guid, this.token);
        mapStore.worker.db.subscriptionDelete(this.meta.guid);
    }

    /**
     * Upsert a feature into the mission.
     * This will udpate the feature in the local DB, submit it to the TAK Server and
     * mark the subscription as dirty for a re-render
     *
     * @param cot - The COT object to upsert
     */
    async updateFeature(cot: COT): Promise<void> {
        this.cots.set(String(cot.id), cot);

        this._dirty = true;

        const feat = cot.as_feature({
            clone: true
        });

        feat.properties.dest = [{
            mission: this.meta.name
        }];

        await this._atlas.conn.sendCOT(feat);
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
                headers: Subscription.headers(this.token),
                token:  atlas.token
            })
        }
    }

    async updateLogs(): Promise<void> {
        if (this._remote) return;

        const atlas = this._atlas as Atlas;

        const logs = await Subscription.logList(this.meta.guid, {
            missionToken: this.token,
            token: atlas.token
        });
        this.logs.splice(0, this.logs.length, ...logs.items);
    }

    headers(): Record<string, string> {
        return Subscription.headers(this.token);
    }

    static async load(
        atlas: Atlas,
        guid: string,
        token?: string
    ): Promise<Subscription> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid));
        url.searchParams.append('logs', 'true');

        const mission = await std(url, {
            headers: Subscription.headers(token),
            token: atlas.token
        }) as Mission;

        const logs = mission.logs || [] as Array<MissionLog>;
        delete mission.logs;

        const role = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/role', {
            headers: Subscription.headers(token),
            token: atlas.token
        }) as MissionRole;

        const sub = new Subscription(
            atlas,
            mission,
            role,
            logs,
            { token }
        );

        const fc = await std('/api/marti/missions/' + encodeURIComponent(guid) + '/cot', {
            headers: Subscription.headers(token),
            token: atlas.token
        }) as FeatureCollection;

        for (const feat of fc.features) {
            const cot = new COT(atlas, feat as Feature, {
                mode: OriginMode.MISSION,
                mode_id: guid
            });

            sub.cots.set(String(cot.id), cot);
        }

        return sub;
    }

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

    static async subscriptions(
        guid: string,
        opts: {
            token?: string,
            missionToken?: string
        } = {}
    ): Promise<MissionSubscriptions> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(guid)}/subscriptions/roles`);

        const res = await std(url, {
            method: 'GET',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
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

    static async logCreate(
        guid: string,
        body: object,
        opts: {
            token?: string;
            missionToken?: string
        } = {}
    ): Promise<MissionLog> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/log');

        const log = await std(url, {
            method: 'POST',
            body: body,
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        }) as {
            data: MissionLog
        };

        return log.data;
    }

    static async logDelete(
        guid: string,
        logid: string,
        opts: {
            token?: string
            missionToken?: string
        } = {}
    ): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/log/' + encodeURIComponent(logid));

        await std(url, {
            method: 'DELETE',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        });

        return;
    }

    static async logList(
        guid: string,
        opts: {
            token?: string
            missionToken?: string
        }  = {}
    ): Promise<MissionLogList> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/log');

        const list = await std(url, {
            method: 'GET',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        }) as MissionLogList;

        list.items = list.items.map((l) => {
            if (!l.content) l.content = '';
            return l;
        });

        return list;
    }

    static async layerList(
        guid: string,
        opts: {
            token?: string
            missionToken?: string
        } = {}
    ): Promise<MissionLayerList> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(guid)}/layer`);

        return await std(url, {
            method: 'GET',
            token: opts.token,
            headers: Subscription.headers(opts.missionToken)
        }) as MissionLayerList;
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
