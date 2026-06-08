import { db } from '../database.ts';
import { server } from '../std.ts';
import type {
    MissionChanges,
    MissionChange
} from '../types.ts'

/**
 * High Level Wrapper around the Data/Mission Sync API
 */
export default class SubscriptionChanges {
    guid: string;

    token: string;
    missiontoken?: string;

    constructor(
        guid: string,
        opts: {
            token: string,
            missiontoken?: string,
        }
    ) {
        this.token = opts.token;
        this.missiontoken = opts.missiontoken;

        this.guid = guid;
    }

    headers(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.missiontoken) headers.MissionAuthorization = this.missiontoken;
        return headers;
    }

    async refresh(): Promise<void> {
        const { data, error } = await server.GET('/api/marti/missions/{:name}/changes', {
            params: { path: { ':name': this.guid } },
            headers: this.headers()
        });

        if (error || !data) throw new Error('Failed to fetch mission changes');

        const list = data as unknown as MissionChanges;

        await db.transaction('rw', db.subscription_changes, async () => {
            await db.subscription_changes
                .where('mission')
                .equals(this.guid)
                .delete();

            for (const change of list.data) {
                await db.subscription_changes.put({
                    ...change,
                    mission: this.guid
                });
            }
        });
    }

    async list(
        opts?: {
            refresh?: boolean,
        }
    ): Promise<Array<MissionChange>> {
        if (opts?.refresh) {
            await this.refresh();
        }

        const changes = await db.subscription_changes
            .where("mission")
            .equals(this.guid)
            .toArray();

        changes.sort((a, b) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        return changes;
    }
}
