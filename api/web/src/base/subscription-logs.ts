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
    _db: DatabaseType;
    guid: string;

    _token: string;
    _missiontoken: string;

    constructor(
        db: DatabaseType,
        guid: string,
        missiontoken: string,
        token: string
    ) {
        this._db = db;

        this._token = token;
        this._missiontoken = token;

        this.guid = guid;
    }

    async list(opts?: {
        filter?: string,
        refresh: false,
    }): Promise<Array<MissionLog>> {
        if (opts?.refresh) {
            const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/log');

            const list = await std(url, {
                method: 'GET',
                token: this._token,
                headers: {
                    MissionAuthorization: this._missiontoken
                }
            }) as MissionLogList;

            for (const log of list.items) {
                await this._db.subscription_log.put({
                    id: log.id,
                    dtg: log.dtg,
                    created: log.created,
                    mission: sub.meta.guid,
                    content: log.content || '',
                    creatorUid: log.creatorUid,
                    contentHashes: log.contentHashes,
                    keywords: log.keywords
                });
            }
        }

        const logs = await this._db.subscription_log
            .where("mission")
            .equals(this.guid)
            .toArray();

        logs.sort((a, b) => {
            return new Date(b.created).getTime() - new Date(a.created).getTime();
        }).reverse();

        if (opts?.filter) {
            return logs.filter(log => log.content.toLowerCase().includes(opts.filter.toLowerCase()));
        } else {
            return logs
        }
    }

    async create(
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
            token: this._token,
            headers: {
                MissionAuthorization: this._missiontoken
            }
        }) as {
            data: MissionLog
        };

        await this._db.subscription_log.put({
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

    static async update(
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
            token: this._token,
            headers: {
                MissionAuthorization: this._missiontoken
            }
        }) as {
            data: MissionLog
        };

        this._db.subscription_log.put({
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
        logid: string,
    ): Promise<void> {
        const url = stdurl('/api/marti/missions/' + encodeURIComponent(this.guid) + '/log/' + encodeURIComponent(logid));

        await std(url, {
            method: 'DELETE',
            token: this._token,
            headers: {
                MissionAuthorization: this._missiontoken
            }
        });

        await this._db.subscription_log.delete(logid);
    }
}
