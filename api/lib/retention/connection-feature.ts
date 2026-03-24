import Err from '@openaddresses/batch-error';
import { sql } from 'drizzle-orm';

import { ConnectionFeature } from '../schema.js';
import type { RetentionConfigValue, RetentionInvocation, RetentionTask, RetentionTaskResult } from '../retention.js';
import type Config from '../config.js';

function parseStale(raw: unknown): number | undefined {
    if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;

    const stale = new Date(raw).getTime();
    if (!Number.isFinite(stale)) return undefined;

    return stale;
}

function asString(value: RetentionConfigValue | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

const task: RetentionTask = {
    name: 'connection-feature',
    run: async (config: Config, retention: RetentionInvocation): Promise<RetentionTaskResult> => {
        const start = Date.now();
        const now = asString(retention.config.now) ? new Date(String(retention.config.now)) : new Date();

        if (Number.isNaN(now.getTime())) {
            throw new Err(400, null, 'Invalid retention config.now value');
        }

        const features = await config.models.ConnectionFeature.pool
            .select({
                connection: ConnectionFeature.connection,
                id: ConnectionFeature.id,
                properties: ConnectionFeature.properties,
            })
            .from(ConnectionFeature);

        const expired = features.filter((feature) => {
            const properties = feature.properties as Record<string, unknown> | null;
            const stale = parseStale(properties?.stale);

            if (stale === undefined) return false;
            return stale < now.getTime();
        });

        if (expired.length) {
            const clauses = expired.map((feature) => {
                return sql`(
                    ${ConnectionFeature.connection} = ${feature.connection}
                    AND ${ConnectionFeature.id} = ${feature.id}
                )`;
            });

            await config.models.ConnectionFeature.delete(sql`${sql.join(clauses, sql` OR `)}`);
        }

        return {
            name: task.name,
            status: 'success',
            scanned: features.length,
            deleted: expired.length,
            duration: Date.now() - start,
            message: expired.length ? undefined : 'No stale connection features found'
        };
    }
};

export default task;