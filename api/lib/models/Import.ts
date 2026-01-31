import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Import, ImportResult } from '../schema.js';
import { sql, eq, asc, desc, SQL, is } from 'drizzle-orm';
import Err from '@openaddresses/batch-error'
import { ImportResponse, ImportResult as ImportResultType } from '../types.js'
import type { Static } from '@sinclair/typebox'

export default class ImportModel extends Modeler<typeof Import> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Import);
    }

    async augmented_from(id: string | SQL<unknown>): Promise<Static<typeof ImportResponse>> {
        const SubTable = this.pool
            .select({
                id: ImportResult.import,
                results: sql`JSON_AGG(import_result.*)`.as('results')
            })
            .from(ImportResult)
            .groupBy(ImportResult.import)
            .as('results');

        const pgres = await this.pool
            .select({
                import: Import,
                results: sql`COALESCE(${SubTable.results}, '[]'::JSON)`.as('results')
            })
            .from(Import)
            .leftJoin(SubTable, eq(Import.id, SubTable.id))
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].import,
            results: pgres[0].results as Static<typeof ImportResultType>[]
        }
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof ImportResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                id: ImportResult.import,
                results: sql`JSON_AGG(import_result.*)`.as('results')
            })
            .from(ImportResult)
            .groupBy(ImportResult.import)
            .as('results');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                import: Import,
                results: sql`COALESCE(${SubTable.results}, '[]'::JSON)`.as('results')
            })
            .from(Import)
            .leftJoin(SubTable, eq(Import.id, SubTable.id))
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10))

        if (pgres.length === 0) {
            return {
                total: 0,
                items: []
            }
        }

        return {
            total: parseInt(pgres[0].count),
            items: pgres.map((res) => {
                return {
                    ...res.import,
                    results: res.results as Static<typeof ImportResultType>[]
                }
            })
        }
    }
}
