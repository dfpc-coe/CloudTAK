import Modeler from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Setting } from '../schema.js';
import { eq } from 'drizzle-orm';

export default class SettingModel extends Modeler<typeof Setting> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Setting);
    }

    async typed<T>(key: string, defaultValue?: T): Promise<{
        key: string,
        value: T
    }> {
        const pgres = await this.pool
        .select({
            key: Setting.key,
            value: Setting.value,
        })
        .from(Setting)
        .where(eq(this.requiredPrimaryKey(), key))
        .limit(1);

        if (pgres.length !== 1) {
            if (defaultValue !== undefined) {
                return { key, value: defaultValue }
            } else {
                throw new Err(404, null, `Item Not Found`);
            }
        }

        return {
            key: key,
            value: pgres[0].value as T
        }
    }
}
