import Err from '@openaddresses/batch-error'
import Modeler from '@openaddresses/batch-generic';
import { Type } from '@sinclair/typebox'
import type { Static } from '@sinclair/typebox'
import { MissionTemplateResponse, MissionTemplateLogResponse } from '../types.js'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { MissionTemplate, MissionTemplateLog } from '../schema.js';
import { SQL, is, sql, eq } from 'drizzle-orm';

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
            logs: pgres[0].logs
        } as Static<typeof MissionTemplateSingleResponse>;
    }
}
