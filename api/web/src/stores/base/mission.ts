import COT from './cot.ts'
import { std, stdurl } from '../../std.ts';
import type {
    Mission,
    MissionLog,
    MissionList,
    MissionLogList,
    MissionSubscriptions
} from '../../types.ts';

export default class Subscription {
    meta: Mission;
    token?: string;
    logs: Array<MissionLog>;
    cots: Map<string, COT>;

    // Should features be automatically added
    auto: boolean;

    constructor(
        mission: Mission,
        logs: Array<MissionLog>,
        token?: string
    ) {
        this.meta = mission;
        this.logs = logs;
        this.token = token;
        this.cots = new Map();

        this.auto = false;
    }

    static async load(guid: string, token?: string): Promise<Subscription> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(guid));
        url.searchParams.append('logs', 'true');

        const mission = await std(url, {
            headers: Subscription.headers(token)
        }) as Mission;

        const logs = mission.logs || [] as Array<MissionLog>;
        delete mission.logs;

        return new Subscription(mission, logs);
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

    async updateLogs() {
        const logs = await Subscription.logList(this.meta.guid);
        this.logs.splice(0, this.logs.length, ...logs.items);
    }

    headers(): Record<string, string> {
        return Subscription.headers(this.token);
    }
}
