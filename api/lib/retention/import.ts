import { sql } from 'drizzle-orm';

import type Config from '../config.js';
import { Import } from '../schema.js';
import ImportControl from '../control/import.js';
import type { RetentionTask, RetentionTaskResult } from '../retention.js';

const task: RetentionTask = {
    name: 'import',
    run: async (config: Config): Promise<RetentionTaskResult> => {
        const start = Date.now();

        const days = (await config.models.Setting.typed('retention::import::days')).value || 30;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const importControl = new ImportControl(config);

        let deleted = 0;
        for await (const imp of config.models.Import.augmented_iter({
            where: sql`
                ${Import.created} < ${cutoff.toISOString()}::timestamptz
            `
        })) {
            await importControl.delete(imp.id);
            deleted++;
        }

        return {
            name: task.name,
            status: 'success',
            deleted,
            duration: Date.now() - start,
            message: deleted ? undefined : 'No expired imports found'
        };
    }
};

export default task;
