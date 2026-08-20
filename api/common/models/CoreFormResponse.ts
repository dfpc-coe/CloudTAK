import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreFormResponseResponse } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreFormResponse, CoreEventResponse } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

export default class CoreFormResponseModel extends Modeler<typeof CoreFormResponse> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreFormResponse);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreFormResponseResponse>> {
        const SubTable = this.pool
            .select({
                response: CoreEventResponse.response,
                events: sql`JSON_AGG(core_event_response.event ORDER BY core_event_response.event)`.as('events'),
            })
            .from(CoreEventResponse)
            .groupBy(CoreEventResponse.response)
            .as('events');

        const pgres = await this.pool
            .select({
                item: CoreFormResponse,
                events: sql`COALESCE(${SubTable.events}, '[]'::JSON)`.as('events'),
            })
            .from(CoreFormResponse)
            .leftJoin(SubTable, eq(CoreFormResponse.id, SubTable.response))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].item,
            events: pgres[0].events as string[],
        };
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof CoreFormResponseResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                response: CoreEventResponse.response,
                events: sql`JSON_AGG(core_event_response.event ORDER BY core_event_response.event)`.as('events'),
            })
            .from(CoreEventResponse)
            .groupBy(CoreEventResponse.response)
            .as('events');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                item: CoreFormResponse,
                events: sql`COALESCE(${SubTable.events}, '[]'::JSON)`.as('events'),
            })
            .from(CoreFormResponse)
            .leftJoin(SubTable, eq(CoreFormResponse.id, SubTable.response))
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10));

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                total: parseInt(pgres[0].count),
                items: pgres.map((t) => {
                    return {
                        ...t.item,
                        events: t.events as string[],
                    };
                }),
            };
        }
    }
}
