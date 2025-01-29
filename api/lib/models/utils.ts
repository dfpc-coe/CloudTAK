import type { SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * @param shape Potential for SQL injections, so you shouldn't allow user-specified key names
 */
export function jsonBuildObject<T extends Record<string, PgColumn | SQL>>(shape: T) {
    const chunks: SQL[] = []

    Object.entries(shape).forEach(([key, value]) => {
        if (chunks.length > 0) {
            chunks.push(sql.raw(','))
        }
        chunks.push(sql.raw(`'${key}',`))
        chunks.push(sql`${value}`)
    })

    return sql`json_build_object(${sql.join(chunks)})`
}
