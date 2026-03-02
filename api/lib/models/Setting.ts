import Modeler from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { Static } from '@sinclair/typebox';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Setting } from '../schema.js';
import { eq, inArray } from 'drizzle-orm';
import { FullConfig } from '../types.js';
import { FullConfigDefaults } from '../defaults.js';

type FullConfigType = Static<typeof FullConfig>;

export default class SettingModel extends Modeler<typeof Setting> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Setting);
    }

    async typed<K extends keyof FullConfigType>(
        key: K,
        defaultValue?: FullConfigType[K]
    ): Promise<{ key: K; value: FullConfigType[K] }> {
        const pgres = await this.pool
            .select({
                key: Setting.key,
                value: Setting.value,
            })
            .from(Setting)
            .where(eq(this.requiredPrimaryKey(), key))
            .limit(1);

        if (pgres.length !== 1) {
            const configDefault = FullConfigDefaults[key];
            if (configDefault !== undefined) {
                return { key, value: configDefault as FullConfigType[K] };
            } else if (defaultValue !== undefined) {
                return { key, value: defaultValue };
            } else {
                throw new Err(404, null, `Item Not Found`);
            }
        }

        return {
            key,
            value: pgres[0].value as FullConfigType[K]
        };
    }

    async typedMany<K extends keyof FullConfigType>(defaults: Pick<FullConfigType, K>): Promise<Pick<FullConfigType, K>> {
        const keys = Object.keys(defaults) as K[];

        const pgres = await this.pool
            .select({
                key: Setting.key,
                value: Setting.value,
            })
            .from(Setting)
            .where(inArray(Setting.key, keys as string[]));

        const found = new Map(pgres.map((r) => [r.key, r.value]));

        const result = { ...defaults };
        for (const key of keys) {
            if (found.has(key as string)) {
                result[key] = found.get(key as string) as Pick<FullConfigType, K>[K];
            } else if (FullConfigDefaults[key] !== undefined) {
                result[key] = FullConfigDefaults[key] as Pick<FullConfigType, K>[K];
            }
        }

        return result;
    }
}
