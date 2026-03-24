import Err from '@openaddresses/batch-error';
import { sql } from 'drizzle-orm';

import type Config from '../config.js';
import { ConnectionFeature } from '../schema.js';
import type { RetentionConfigValue, RetentionInvocation, RetentionTask, RetentionTaskResult } from '../retention.js';

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

        const deleted = await config.models.ConnectionFeature.pool.delete(ConnectionFeature)
            .where(sql`
                (
                    CASE
                        WHEN jsonb_typeof(${ConnectionFeature.properties}::jsonb -> 'stale') = 'number' THEN to_timestamp((${ConnectionFeature.properties}::jsonb ->> 'stale')::double precision / 1000.0)
                        WHEN jsonb_typeof(${ConnectionFeature.properties}::jsonb -> 'stale') = 'string'
                        THEN (${ConnectionFeature.properties}::jsonb ->> 'stale')::timestamptz
                        ELSE NULL
                    END
                ) < ${now.toISOString()}::timestamptz
            `)
            .returning({ deleted: sql<number>`1` });

        return {
            name: task.name,
            status: 'success',
            deleted: deleted.length,
            duration: Date.now() - start,
            message: deleted.length ? undefined : 'No stale connection features found'
        };
    }
};

export default task;
