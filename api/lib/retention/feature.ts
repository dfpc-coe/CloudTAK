import { sql } from 'drizzle-orm';

import type Config from '../config.js';
import { ProfileFeature } from '../schema.js';
import type { RetentionTask, RetentionTaskResult } from '../retention.js';

const task: RetentionTask = {
    name: 'feature',
    run: async (config: Config): Promise<RetentionTaskResult> => {
        const start = Date.now();

        const days = (await config.models.Setting.typed('retention::feature::days')).value || 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const deleted = await config.models.ProfileFeature.pool.delete(ProfileFeature)
            .where(sql`
                ${ProfileFeature.deleted} = true
                AND (${ProfileFeature.properties} ->> 'time')::timestamptz < ${cutoff.toISOString()}::timestamptz
            `)
            .returning({ deleted: sql<number>`1` });

        return {
            name: task.name,
            status: 'success',
            deleted: deleted.length,
            duration: Date.now() - start,
            message: deleted.length ? undefined : 'No expired deleted features found',
        };
    },
};

export default task;
