import { sql } from 'drizzle-orm';

import type Config from '../config.js';
import { ConnectionFeature } from '../schema.js';
import type { RetentionTask, RetentionTaskResult } from '../retention.js';

const task: RetentionTask = {
    name: 'connection-feature',
    run: async (config: Config): Promise<RetentionTaskResult> => {
        const start = Date.now();
        const now = new Date();

        const deleted = await config.models.ConnectionFeature.pool.delete(ConnectionFeature)
            .where(sql`
                (
                    CASE
                        WHEN jsonb_typeof(${ConnectionFeature.properties} -> 'stale') = 'string'
                        THEN (${ConnectionFeature.properties} ->> 'stale')::timestamptz
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
