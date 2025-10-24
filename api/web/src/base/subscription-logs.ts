import { std, stdurl } from '../std.ts';
import type { DatabaseType } from '../base/database.ts';
import type {
    MissionLog,
    MissionLogList
} from '../types.ts'

/**
 * High Level Wrapper around the Data/Mission Sync API
 */
export default class SubscriptionLog {
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
        this.missiontoken = opts.token;

        this.guid = guid;
    }

    async refresh(
        db: DatabaseType
    ): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/log');

        const list = await std(url, {
            method: 'GET',
            token: this.token,
            headers: {
                MissionAuthorization: this.missiontoken
            }
        }) as MissionLogList;

        await db.transaction('rw', db.subscription_log, async () => {
            await db.subscription_log
                .where('mission')
                .equals(this.guid)
                .delete();

            for (const log of list.items) {
                await db.subscription_log.put({
                    id: log.id,
                    dtg: log.dtg,
                    created: log.created,
                    mission: this.guid,
                    content: log.content || '',
                    creatorUid: log.creatorUid,
                    contentHashes: log.contentHashes,
                    keywords: log.keywords
                });
            }
        });
    }

    async list(
        db: DatabaseType,
        opts?: {
            filter?: string,
            refresh: false,
        }
    ): Promise<Array<MissionLog>> {
        if (opts?.refresh) {
            await this.refresh(db);
        }

        const logs = await db.subscription_log
            .where("mission")
            .equals(this.guid)
            .toArray();

        logs.sort((a, b) => {
            return new Date(b.created).getTime() - new Date(a.created).getTime();
        }).reverse();

        return logs;
    }

    async create(
        db: DatabaseType,
        body: {
            dtg?: string;
            content: string;
            contentHashes?: Array<string>;
            keywords?: Array<string>;
        }
    ): Promise<MissionLog> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/log');

        const log = await std(url, {
            method: 'POST',
            body: body,
            token: this.token,
            headers: {
                MissionAuthorization: this.missiontoken
            }
        }) as {
            data: MissionLog
        };

        await db.subscription_log.put({
            id: log.data.id,
            dtg: log.data.dtg,
            created: log.data.created,
            mission: this.guid,
            content: log.data.content || '',
            creatorUid: log.data.creatorUid,
            contentHashes: log.data.contentHashes,
            keywords: log.data.keywords
        });

        return log.data;
    }

    async update(
        db: DatabaseType,
        logid: string,
        body: {
            dtg?: string;
            content: string;
            contentHashes?: Array<string>;
            keywords?: Array<string>;
        },
    ): Promise<MissionLog> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/log/' + encodeURIComponent(logid));

        const log = await std(url, {
            method: 'PATCH',
            body: body,
            token: this.token,
            headers: {
                MissionAuthorization: this.missiontoken
            }
        }) as {
            data: MissionLog
        };

        await db.subscription_log.put({
            id: log.data.id,
            dtg: log.data.dtg,
            created: log.data.created,
            mission: this.guid,
            content: log.data.content || '',
            creatorUid: log.data.creatorUid,
            contentHashes: log.data.contentHashes,
            keywords: log.data.keywords
        });

        return log.data;
    }

    async delete(
        db: DatabaseType,
        logid: string,
    ): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/log/' + encodeURIComponent(logid));

        await std(url, {
            method: 'DELETE',
            token: this.token,
            headers: {
                MissionAuthorization: this.missiontoken
            }
        });

        await db.subscription_log.delete(logid);
    }
}
