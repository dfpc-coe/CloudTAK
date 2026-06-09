import { db } from '../database.ts';
import type { DBSubscriptionLog } from '../database.ts';
import { server, downloadUrl } from '../std.ts';
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
        this.missiontoken = opts.missiontoken;

        this.guid = guid;
    }

    headers(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.missiontoken) headers.MissionAuthorization = this.missiontoken;
        return headers;
    }

    async refresh(): Promise<void> {
        const { data, error } = await server.GET('/api/marti/missions/{:name}/log', {
            params: { path: { ':name': this.guid }, query: { format: 'json' as const, download: false } },
            headers: this.headers()
        });

        if (error || !data) throw new Error('Failed to fetch mission log');

        const list = data as unknown as MissionLogList;

        await db.transaction('rw', db.subscription_log, async () => {
            const readLogs = new Set(
                await db.subscription_log
                    .where('mission')
                    .equals(this.guid)
                    .filter(l => !!l.read)
                    .primaryKeys()
            );

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
                    missionNames: log.missionNames,
                    servertime: log.servertime,
                    creatorUid: log.creatorUid,
                    contentHashes: log.contentHashes,
                    keywords: log.keywords,
                    read: readLogs.has(log.id)
                });
            }
        });
    }

    async list(
        opts?: {
            filter?: string,
            refresh?: boolean,
        }
    ): Promise<Array<DBSubscriptionLog>> {
        if (opts?.refresh) {
            await this.refresh();
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

    async read(): Promise<void> {
        await db.subscription_log
            .where('mission')
            .equals(this.guid)
            .modify({ read: true });
    }

    async create(
        body: {
            dtg?: string;
            content: string;
            contentHashes?: Array<string>;
            keywords?: Array<string>;
        }
    ): Promise<MissionLog> {
        const { data, error } = await server.POST('/api/marti/missions/{:name}/log', {
            params: { path: { ':name': this.guid } },
            headers: this.headers(),
            body: body
        });

        if (error || !data) throw new Error('Failed to create mission log');

        const log = data as unknown as { data: MissionLog };

        await db.subscription_log.put({
            id: log.data.id,
            dtg: log.data.dtg,
            created: log.data.created,
            mission: this.guid,
            content: log.data.content || '',
            missionNames: log.data.missionNames,
            servertime: log.data.servertime,
            creatorUid: log.data.creatorUid,
            contentHashes: log.data.contentHashes,
            keywords: log.data.keywords,
            read: true
        });

        return log.data;
    }

    async update(
        logid: string,
        body: {
            dtg: string;
            content: string;
            contentHashes?: Array<string>;
            keywords?: Array<string>;
        },
    ): Promise<MissionLog> {
        const { data, error } = await server.PATCH('/api/marti/missions/{:name}/log/{:logid}', {
            params: { path: { ':name': this.guid, ':logid': logid } },
            headers: this.headers(),
            body: body
        });

        if (error || !data) throw new Error('Failed to update mission log');

        const log = data as unknown as { data: MissionLog };

        await db.subscription_log.put({
            id: log.data.id,
            dtg: log.data.dtg,
            created: log.data.created,
            mission: this.guid,
            missionNames: log.data.missionNames,
            servertime: log.data.servertime,
            content: log.data.content || '',
            creatorUid: log.data.creatorUid,
            contentHashes: log.data.contentHashes,
            keywords: log.data.keywords,
            read: true
        });

        return log.data;
    }

    async delete(
        logid: string,
    ): Promise<void> {
        await server.DELETE('/api/marti/missions/{:name}/log/{:log}', {
            params: { path: { ':name': this.guid, ':log': logid } },
            headers: this.headers()
        });

        await db.subscription_log.delete(logid);
    }

    async download(format: string): Promise<void> {
        await downloadUrl(
            `/api/marti/missions/${encodeURIComponent(this.guid)}/log?download=true&format=${encodeURIComponent(format)}`,
            {
                filename: `mission-logs.${format}`,
                token: true
            }
        );
    }
}
