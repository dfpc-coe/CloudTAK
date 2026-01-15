import Err from '@openaddresses/batch-error'
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Type } from '@sinclair/typebox'
import type { Static } from '@sinclair/typebox'
import { MissionTemplateResponse, MissionTemplateLogResponse } from '../types.js'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { MissionTemplate, MissionTemplateLog } from '../schema.js';
import { SQL, is, sql, eq, desc, asc } from 'drizzle-orm';

export const MissionTemplateSingleResponse = Type.Composite([
    MissionTemplateResponse,
    Type.Object({
        logs: Type.Array(MissionTemplateLogResponse)
    })
])

export default class MissionTemplateModel extends Modeler<typeof MissionTemplate> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, MissionTemplate);
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof MissionTemplateResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                template: MissionTemplate
            })
            .from(MissionTemplate)
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
                    ...res.template,
                    keywords: res.template.keywords ? res.template.keywords.split(',') : []
                }
            })
        }
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof MissionTemplateSingleResponse>> {
        const SubTable = this.pool
            .select({
                id: MissionTemplateLog.template,
                logs: sql`JSON_AGG(mission_template_log.*)`.as('logs')
            })
            .from(MissionTemplateLog)
            .groupBy(MissionTemplateLog.template)
            .as('logs');

        const pgres = await this.pool
            .select({
                template: MissionTemplate,
                logs: sql`COALESCE(${SubTable.logs}, '[]'::JSON)`.as('logs')
            })
            .from(MissionTemplate)
            .leftJoin(SubTable, eq(MissionTemplate.id, SubTable.id))
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].template,
            keywords: pgres[0].template.keywords ? pgres[0].template.keywords.split(',') : [],
            logs: pgres[0].logs
        } as Static<typeof MissionTemplateSingleResponse>;
    }
}
