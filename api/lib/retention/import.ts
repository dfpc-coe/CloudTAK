import { sql } from 'drizzle-orm';

import type Config from '../config.js';
import { Import } from '../schema.js';
import type { RetentionTask, RetentionTaskResult } from '../retention.js';

const task: RetentionTask = {
    name: 'import',
    run: async (config: Config): Promise<RetentionTaskResult> => {
        const start = Date.now();

        const days = (await config.models.Setting.typed('retention::import::days')).value || 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const deleted = await config.models.Import.pool.delete(Import)
            .where(sql`
                ${Import.created} < ${cutoff.toISOString()}::timestamptz
            `)
            .returning({ deleted: sql<number>`1` });

        return {
            name: task.name,
            status: 'success',
            deleted: deleted.length,
            duration: Date.now() - start,
            message: deleted.length ? undefined : 'No expired imports found'
        };
    }
};

export default task;
