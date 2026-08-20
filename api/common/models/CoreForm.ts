import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreFormResponse } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreForm, CoreFormBoard } from '../schema.js';
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
                form: CoreFormBoard.form,
                boards: sql`JSON_AGG(core_form_board.board ORDER BY core_form_board.board)`.as('boards'),
            })
            .from(CoreFormBoard)
            .groupBy(CoreFormBoard.form)
            .as('boards');

        const pgres = await this.pool
            .select({
                form: CoreForm,
                boards: sql`COALESCE(${SubTable.boards}, '[]'::JSON)`.as('boards'),
            })
            .from(CoreForm)
            .leftJoin(SubTable, eq(CoreForm.id, SubTable.form))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].form,
            boards: pgres[0].boards as string[],
        };
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof CoreFormResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                form: CoreFormBoard.form,
                boards: sql`JSON_AGG(core_form_board.board ORDER BY core_form_board.board)`.as('boards'),
            })
            .from(CoreFormBoard)
            .groupBy(CoreFormBoard.form)
            .as('boards');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                form: CoreForm,
                boards: sql`COALESCE(${SubTable.boards}, '[]'::JSON)`.as('boards'),
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
                        boards: t.boards as string[],
                    };
                }),
            };
        }
    }
}
