import Modeler from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { Static } from '@sinclair/typebox';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Setting } from '../schema.js';
import { eq, inArray } from 'drizzle-orm';
import { FullConfig } from '../types.js';
import { FullConfigDefaults } from '../defaults.js';

type FullConfigType = Static<typeof FullConfig>;

/**
 * Coerce a raw DB text value into the type declared by the FullConfig schema
 * for the given key. Settings are stored as text, so booleans arrive as
 * 'true'/'false' and numbers as '4', etc.
 */
function coerceRawValue<K extends keyof FullConfigType>(key: K, raw: string): FullConfigType[K] {
    const schema = FullConfig.properties[key] as any;

    if (schema.type === 'boolean') return (raw === 'true') as FullConfigType[K];
    if (schema.type === 'integer' || schema.type === 'number') return Number(raw) as FullConfigType[K];

    // Handle union types e.g. Type.Union([Type.Null(), Type.Integer()])
    if (Array.isArray(schema.anyOf)) {
        const hasNumber = schema.anyOf.some((s: any) => s.type === 'integer' || s.type === 'number');
        if (hasNumber) return Number(raw) as FullConfigType[K];
    }

    return raw as FullConfigType[K];
}

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
            value: coerceRawValue(key, pgres[0].value)
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
                result[key] = coerceRawValue(key, found.get(key as string) as string) as Pick<FullConfigType, K>[K];
            } else if (FullConfigDefaults[key] !== undefined) {
                result[key] = FullConfigDefaults[key] as Pick<FullConfigType, K>[K];
            }
        }

        return result;
    }
}
