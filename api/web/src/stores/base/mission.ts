import COT from './cot.ts'
import { std, stdurl } from '../../std.ts';
import type { Mission, MissionLog, MissionLogList } from '../../types.ts';

export default class Subscription {
    meta: Mission;
    token?: string;
    logs: Array<MissionLog>;
    cots: Map<string, COT>;

    constructor(
        mission: Mission,
        logs: Array<MissionLog>,
        token?: string
    ) {
        this.meta = mission;
        this.logs = logs;
        this.token = token;
        this.cots = new Map();
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

    static headers(token?: string): Record<string, string> {
        const headers: Record<string, string> = {};
        if (token) headers.MissionAuthorization = token;
        return headers;
    }

    async updateLogs() {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.meta.guid) + '/log');

        const logs = await std(url, {
            headers: this.headers()
        }) as MissionLogList;

        this.logs = logs.items;
    }

    headers(): Record<string, string> {
        return Subscription.headers(this.token);
    }
}
