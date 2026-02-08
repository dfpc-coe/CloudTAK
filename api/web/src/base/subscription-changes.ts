import { db } from './database.ts';
import { std, stdurl } from '../std.ts';
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
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/changes');

        const list = await std(url, {
            method: 'GET',
            token: this.token,
            headers: this.headers()
        }) as MissionChanges;

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
