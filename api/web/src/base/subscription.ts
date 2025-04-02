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
    MissionChanges,
    MissionLogList,
    MissionLayerList,
    MissionSubscriptions
} from '../types.ts';

export default class Subscription {
    meta: Mission;
    role: MissionRole;
    token?: string;
    logs: Array<MissionLog>;
    cots: Map<string, COT>;

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
            remote?: BroadcastChannel | null
        }
    ) {
        this._atlas = atlas;
        this._remote = (opts && opts.remote !== undefined) ? opts.remote : null;

        this.meta = mission;
        this.role = role;
        this.logs = logs;
        if (opts && opts.token) this.token = opts.token;
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

    async updateLogs(): Promise<void> {
        const logs = await Subscription.logList(this.meta.guid);
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

    static async subscriptions(guid: string, token: string | undefined): Promise<MissionSubscriptions> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(guid)}/subscriptions/roles`);

        const res = await std(url, {
            method: 'GET',
            headers: Subscription.headers(token)
        }) as {
            data: MissionSubscriptions
        };

        return res.data
    }

    static async featList(guid: string, token?: string): Promise<FeatureCollection> {
        return await std('/api/marti/missions/' + encodeURIComponent(guid) + '/cot', {
            headers: Subscription.headers(token)
        }) as FeatureCollection;
    }

    static async changes(guid: string, token: string | undefined): Promise<MissionChanges> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/changes');

        return await std(url, {
            method: 'GET',
            headers: Subscription.headers(token)
        }) as MissionChanges;
    }

    static async logCreate(guid: string, token: string | undefined, body: object): Promise<MissionLog> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/log');

        const log = await std(url, {
            method: 'POST',
            body: body,
            headers: Subscription.headers(token)
        }) as {
            data: MissionLog
        };

        return log.data;
    }

    static async logDelete(guid: string, token: string | undefined, logid: string): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/log/' + encodeURIComponent(logid));

        await std(url, {
            method: 'DELETE',
            headers: Subscription.headers(token)
        });

        return;
    }

    static async logList(guid: string, token?: string): Promise<MissionLogList> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid) + '/log');

        const list = await std(url, {
            method: 'GET',
            headers: Subscription.headers(token)
        }) as MissionLogList;

        list.items = list.items.map((l) => {
            if (!l.content) l.content = '';
            return l;
        });

        return list;
    }

    static async layerList(guid: string, token?: string): Promise<MissionLayerList> {
        const url = stdurl(`/api/marti/missions/${encodeURIComponent(guid)}/layer`);

        return await std(url, {
            method: 'GET',
            headers: Subscription.headers(token)
        }) as MissionLayerList;
    }

    static async layerDelete(guid: string, layeruid: string, token?: string): Promise<void> {
        const url = stdurl(`/api/marti/missions/${guid}/layer/${layeruid}`);
        await std(url, {
            method: 'DELETE',
            headers: Subscription.headers(token)
        })
    }
}
