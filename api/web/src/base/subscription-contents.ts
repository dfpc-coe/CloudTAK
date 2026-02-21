import { db } from './database.ts';
import { std } from '../std.ts';
import type { DBSubscriptionContent } from './database.ts';
import type { Mission } from '../types.ts';

/**
 * High Level Wrapper around Mission Contents (file attachments)
 */
export default class SubscriptionContents {
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

    /**
     * Populate the subscription_contents table from the Mission's contents field
     */
    async refresh(contents: Mission['contents']): Promise<void> {
        await db.transaction('rw', db.subscription_contents, async () => {
            await db.subscription_contents
                .where('mission')
                .equals(this.guid)
                .delete();

            for (const content of contents) {
                await db.subscription_contents.put({
                    uid: content.data.uid,
                    mission: this.guid,
                    timestamp: content.timestamp,
                    creatorUid: content.creatorUid,
                    keywords: content.data.keywords,
                    name: content.data.name,
                    hash: content.data.hash,
                    submissionTime: content.data.submissionTime,
                    size: content.data.size,
                    mimeType: content.data.mimeType,
                    submitter: content.data.submitter,
                    expiration: content.data.expiration,
                });
            }
        });
    }

    /**
     * Delete/detach a content entry from the mission and remove it from the local database
     */
    async delete(hash: string): Promise<void> {
        await std(`/api/marti/missions/${this.guid}/upload/${hash}`, {
            method: 'DELETE',
            headers: this.headers(),
        });

        await db.subscription_contents
            .where('mission')
            .equals(this.guid)
            .filter((c) => c.hash === hash)
            .delete();
    }

    async list(
        opts?: {
            refresh?: boolean,
            contents?: Mission['contents'],
        }
    ): Promise<Array<DBSubscriptionContent>> {
        if (opts?.refresh && opts.contents) {
            await this.refresh(opts.contents);
        }

        const items = await db.subscription_contents
            .where('mission')
            .equals(this.guid)
            .toArray();

        items.sort((a, b) => {
            return new Date(b.submissionTime).getTime() - new Date(a.submissionTime).getTime();
        });

        return items;
    }
}
