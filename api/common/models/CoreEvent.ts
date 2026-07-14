import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreEventResponse } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEvent, CoreEventChannel } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

export default class CoreEventModel extends Modeler<typeof CoreEvent> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreEvent);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreEventResponse>> {
        const SubTable = this.pool
            .select({
                event: CoreEventChannel.event,
                channels: sql`JSON_AGG(core_event_channel.channel::BIGINT ORDER BY core_event_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreEventChannel)
            .groupBy(CoreEventChannel.event)
            .as('channels');

        const pgres = await this.pool
            .select({
                event: CoreEvent,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreEvent)
            .leftJoin(SubTable, eq(CoreEvent.id, SubTable.event))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].event,
            channels: pgres[0].channels,
        } as Static<typeof CoreEventResponse>;
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof CoreEventResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                event: CoreEventChannel.event,
                channels: sql`JSON_AGG(core_event_channel.channel::BIGINT ORDER BY core_event_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreEventChannel)
            .groupBy(CoreEventChannel.event)
            .as('channels');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                event: CoreEvent,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreEvent)
            .leftJoin(SubTable, eq(CoreEvent.id, SubTable.event))
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
                        ...t.event,
                        channels: t.channels,
                    } as Static<typeof CoreEventResponse>;
                }),
            };
        }
    }
}
