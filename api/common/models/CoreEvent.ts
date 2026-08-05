import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput, GenericIterInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreEventResponse, GeoJSONFeatureGeometryPoint } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEvent, CoreEventChannel } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

/**
 * Every Board of every Channel the Event is shared with, each carrying the
 * Column the Event currently sits in on that Board (null when the Event has
 * not been nominated to it) and the Board's Columns for rendering
 *
 * Correlated against `core_event` so it can be selected alongside either a
 * single Event or a page of them
 */
const BOARDS = sql`COALESCE((
    SELECT JSON_AGG(brd ORDER BY brd.channel, brd.name)
    FROM (
        SELECT
            core_event_board.id AS id,
            core_event_board.name AS name,
            core_event_board.channel::INT AS channel,
            placement."column" AS "column",
            COALESCE((
                SELECT JSON_AGG(col ORDER BY col.position, col.name)
                FROM (
                    SELECT
                        core_event_board_column.id AS id,
                        core_event_board_column.name AS name,
                        core_event_board_column.color AS color,
                        core_event_board_column.type AS type,
                        core_event_board_column.position AS position
                    FROM core_event_board_column
                    WHERE core_event_board_column.board = core_event_board.id
                ) col
            ), '[]'::JSON) AS columns
        FROM core_event_board
        LEFT JOIN core_event_board_event AS placement
            ON placement.board = core_event_board.id
            AND placement.event = core_event.id
        WHERE core_event_board.channel IN (
            SELECT core_event_channel.channel
            FROM core_event_channel
            WHERE core_event_channel.event = core_event.id
        )
    ) brd
), '[]'::JSON)`;

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
                boards: BOARDS.as('boards'),
            })
            .from(CoreEvent)
            .leftJoin(SubTable, eq(CoreEvent.id, SubTable.event))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].event,
            geometry: pgres[0].event.geometry as Static<typeof GeoJSONFeatureGeometryPoint>,
            channels: pgres[0].channels as number[],
            boards: pgres[0].boards as Static<typeof CoreEventResponse>['boards'],
        };
    }

    /** Iterating variant of augmented_list */
    async* augmented_iter(query: GenericIterInput & { boards?: boolean } = {}): AsyncGenerator<Static<typeof CoreEventResponse>> {
        const pagesize = query.pagesize || 100;
        let page = 0;
        let pgres;

        do {
            pgres = await this.augmented_list({
                page,
                limit: pagesize,
                order: query.order,
                where: query.where,
                boards: query.boards,
            });

            for (const row of pgres.items) {
                yield row;
            }

            page++;
        } while (pgres.items.length === pagesize);
    }

    /**
     * `boards` is a correlated subquery run once per returned row - callers
     * that never surface it (ie the Event => CoT broadcast loop) opt out
     */
    async augmented_list(query: GenericListInput & { boards?: boolean } = {}): Promise<GenericList<Static<typeof CoreEventResponse>>> {
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
                boards: (query.boards === false ? sql`'[]'::JSON` : BOARDS).as('boards'),
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
                        geometry: t.event.geometry as Static<typeof GeoJSONFeatureGeometryPoint>,
                        channels: t.channels as number[],
                        boards: t.boards as Static<typeof CoreEventResponse>['boards'],
                    };
                }),
            };
        }
    }
}
