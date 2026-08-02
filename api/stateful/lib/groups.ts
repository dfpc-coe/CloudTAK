import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import { notInArray, sql } from 'drizzle-orm';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import { Channel } from '../../common/schema.js';
import type ConfigStateful from '../config.js';

/**
 * Periodically sync the TAK Server Group list into the channel table
 * via the Admin Certificate
 * @class
 */
export default class Groups {
    config: ConfigStateful;

    /**
     * Guard against overlapping sync runs if a run takes
     * longer than the interval
     */
    syncing: boolean;

    syncInterval?: ReturnType<typeof setInterval>;

    constructor(config: ConfigStateful) {
        this.config = config;
        this.syncing = false;
    }

    async init(): Promise<void> {
        this.syncInterval = setInterval(() => {
            this.sync().catch((err) => {
                console.error('not ok - failed to sync TAK Server Groups:', err);
            });
        }, 5 * 60 * 1000);

        this.syncInterval.unref();

        try {
            await this.sync();
        } catch (err) {
            console.error('not ok - failed to sync TAK Server Groups:', err);
        }
    }

    close(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
        }
    }

    /**
     * The Groups API can only be queried once an Admin Certificate has been
     * configured - until then sync runs are skipped, resuming automatically
     * on the next interval once the server is configured
     */
    configured(): boolean {
        return !!(
            this.config.server.api
            && this.config.server.auth.cert
            && this.config.server.auth.key
        );
    }

    async sync(): Promise<void> {
        if (this.syncing) return;
        if (!this.configured()) return;

        // Re-checked for TypeScript's benefit - configured() cannot narrow class properties
        const { cert, key } = this.config.server.auth;
        if (!cert || !key) return;

        this.syncing = true;

        try {
            const api = await TAKAPI.init(
                new URL(String(this.config.server.api)),
                new APIAuthCertificate(cert, key),
            );

            // The same Group is returned once per direction (IN/OUT) - dedupe on bitpos
            const groups = new Map<number, { name: string; type: string; description: string }>();
            for (const group of (await api.Group.list({ useCache: true })).data) {
                groups.set(group.bitpos, {
                    name: group.name,
                    type: group.type,
                    description: group.description || '',
                });
            }

            for (const [bitpos, group] of groups) {
                await this.config.models.Channel.generate({
                    bitpos, ...group,
                }, {
                    upsert: GenerateUpsert.DO_NOTHING,
                });

                await this.config.models.Channel.commit(bitpos, {
                    ...group,
                    updated: sql`Now()`,
                });
            }

            // The Admin cert is always a member of at least one Group - treat an
            // empty response as an anomaly rather than truncating the table
            if (groups.size) {
                await this.config.models.Channel.delete(
                    notInArray(Channel.bitpos, [...groups.keys()]),
                );
            }
        } finally {
            this.syncing = false;
        }
    }
}
