import Err from '@openaddresses/batch-error'
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import type { Static } from '@sinclair/typebox'
import { MissionTemplateLogResponse } from '../types.js'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { MissionTemplateLog } from '../schema.js';
import { SQL, is, sql, eq, desc, asc } from 'drizzle-orm';

export default class MissionTemplateLogModel extends Modeler<typeof MissionTemplateLog> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, MissionTemplateLog);
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof MissionTemplateLogResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                log: MissionTemplateLog
            })
            .from(MissionTemplateLog)
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
                    ...res.log,
                    keywords: res.log.keywords ? res.log.keywords.split(',') : []
                }
            })
        }
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof MissionTemplateLogResponse>> {
        const pgres = await this.pool
            .select()
            .from(MissionTemplateLog)
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0],
            keywords: pgres[0].keywords ? pgres[0].keywords.split(',') : []
        }
    }
}
