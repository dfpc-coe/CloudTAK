import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreFormResponse } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreForm, CoreFormChannel } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

export default class CoreFormModel extends Modeler<typeof CoreForm> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreForm);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreFormResponse>> {
        const SubTable = this.pool
            .select({
                form: CoreFormChannel.form,
                channels: sql`JSON_AGG(core_form_channel.channel::BIGINT ORDER BY core_form_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreFormChannel)
            .groupBy(CoreFormChannel.form)
            .as('channels');

        const pgres = await this.pool
            .select({
                form: CoreForm,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreForm)
            .leftJoin(SubTable, eq(CoreForm.id, SubTable.form))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].form,
            channels: pgres[0].channels as number[],
        };
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof CoreFormResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                form: CoreFormChannel.form,
                channels: sql`JSON_AGG(core_form_channel.channel::BIGINT ORDER BY core_form_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreFormChannel)
            .groupBy(CoreFormChannel.form)
            .as('channels');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                form: CoreForm,
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
            })
            .from(CoreForm)
            .leftJoin(SubTable, eq(CoreForm.id, SubTable.form))
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
                        ...t.form,
                        channels: t.channels as number[],
                    };
                }),
            };
        }
    }
}
