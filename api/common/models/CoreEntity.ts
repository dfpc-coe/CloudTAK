import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput, GenericIterInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreEntityResponse, GeoJSONFeatureGeometryPoint } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEntity, CoreEntityChannel } from '../schema.js';
import { SQL, is, sql, eq, asc, desc } from 'drizzle-orm';

/**
 * Every Board of every Channel the Event is shared with, each carrying the
 * Column the Event currently sits in on that Board (null when the Event has
 * not been nominated to it) and the Board's Columns for rendering
 *
 * Correlated against `core_entity` so it can be selected alongside either a
 * single Event or a page of them
 */
const BOARDS = sql`COALESCE((
    SELECT JSON_AGG(brd ORDER BY brd.channel, brd.name)
    FROM (
        SELECT
            core_entity_board.id AS id,
            core_entity_board.name AS name,
            core_entity_board.channel::INT AS channel,
            placement."column" AS "column",
            COALESCE((
                SELECT JSON_AGG(col ORDER BY col.position, col.name)
                FROM (
                    SELECT
                        core_entity_board_column.id AS id,
                        core_entity_board_column.name AS name,
                        core_entity_board_column.color AS color,
                        core_entity_board_column.type AS type,
                        core_entity_board_column.position AS position
                    FROM core_entity_board_column
                    WHERE core_entity_board_column.board = core_entity_board.id
                ) col
            ), '[]'::JSON) AS columns
        FROM core_entity_board
        LEFT JOIN core_entity_board_event AS placement
            ON placement.board = core_entity_board.id
            AND placement.event = core_entity.id
        WHERE core_entity_board.channel IN (
            SELECT core_entity_channel.channel
            FROM core_entity_channel
            WHERE core_entity_channel.event = core_entity.id
        )
    ) brd
), '[]'::JSON)`;

/** An Event is active until its ended time - a future ended keeps it active until then */
export const ACTIVE = sql<boolean>`(${CoreEntity.ended} IS NULL OR ${CoreEntity.ended} > Now())`;

export default class CoreEntityModel extends Modeler<typeof CoreEntity> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreEntity);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreEntityResponse>> {
        const SubTable = this.pool
            .select({
                event: CoreEntityChannel.event,
                channels: sql`JSON_AGG(core_entity_channel.channel::BIGINT ORDER BY core_entity_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreEntityChannel)
            .groupBy(CoreEntityChannel.event)
            .as('channels');

        const pgres = await this.pool
            .select({
                event: CoreEntity,
                active: ACTIVE.as('active'),
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
                boards: BOARDS.as('boards'),
            })
            .from(CoreEntity)
            .leftJoin(SubTable, eq(CoreEntity.id, SubTable.event))
            .where(is(id, SQL) ? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1);

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return {
            ...pgres[0].event,
            active: pgres[0].active,
            geometry: pgres[0].event.geometry as Static<typeof GeoJSONFeatureGeometryPoint>,
            channels: pgres[0].channels as number[],
            boards: pgres[0].boards as Static<typeof CoreEntityResponse>['boards'],
        };
    }

    /** Iterating variant of augmented_list */
    async* augmented_iter(query: GenericIterInput & { boards?: boolean } = {}): AsyncGenerator<Static<typeof CoreEntityResponse>> {
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
    async augmented_list(query: GenericListInput & { boards?: boolean } = {}): Promise<GenericList<Static<typeof CoreEntityResponse>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const SubTable = this.pool
            .select({
                event: CoreEntityChannel.event,
                channels: sql`JSON_AGG(core_entity_channel.channel::BIGINT ORDER BY core_entity_channel.channel::BIGINT)`.as('channels'),
            })
            .from(CoreEntityChannel)
            .groupBy(CoreEntityChannel.event)
            .as('channels');

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                event: CoreEntity,
                active: ACTIVE.as('active'),
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
                boards: (query.boards === false ? sql`'[]'::JSON` : BOARDS).as('boards'),
            })
            .from(CoreEntity)
            .leftJoin(SubTable, eq(CoreEntity.id, SubTable.event))
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
                        active: t.active,
                        geometry: t.event.geometry as Static<typeof GeoJSONFeatureGeometryPoint>,
                        channels: t.channels as number[],
                        boards: t.boards as Static<typeof CoreEntityResponse>['boards'],
                    };
                }),
            };
        }
    }
}
