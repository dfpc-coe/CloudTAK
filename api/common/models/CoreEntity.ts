import Err from '@openaddresses/batch-error';
import Modeler, { GenericList, GenericListInput, GenericIterInput } from '@openaddresses/batch-generic';
import { Static } from '@sinclair/typebox';
import { CoreEntityResponse, GeoJSONFeatureGeometryPoint } from '../types.js';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CoreEntity, CoreEntityEvent, CoreEntityChannel } from '../schema.js';
import { LayerMapping_Destination } from '../enums.js';
import type { PgInsertValue } from 'drizzle-orm/pg-core';
import { SQL, is, sql, eq, asc, desc, getTableColumns } from 'drizzle-orm';

/** kind is internal - keep it out of payloads */
export const EntityColumns = Object.fromEntries(
    Object.entries(getTableColumns(CoreEntity)).filter(([name]) => name !== 'kind'),
) as Omit<ReturnType<typeof getTableColumns<typeof CoreEntity>>, 'kind'>;

/** Event side table columns - the shared primary key is already selected from core_entity */
const EventColumns = Object.fromEntries(
    Object.entries(getTableColumns(CoreEntityEvent)).filter(([name]) => name !== 'id'),
) as Omit<ReturnType<typeof getTableColumns<typeof CoreEntityEvent>>, 'id'>;

const EVENT_KEYS = new Set(Object.keys(EventColumns));

export type WithSQL<T> = { [K in keyof T]: T[K] | SQL };

export type CoreEntityEventInsert = WithSQL<Omit<typeof CoreEntity.$inferInsert, 'kind'> & Omit<typeof CoreEntityEvent.$inferInsert, 'id'>>;
export type CoreEntityEventUpdate = Partial<WithSQL<Omit<typeof CoreEntity.$inferInsert, 'id' | 'kind'> & Omit<typeof CoreEntityEvent.$inferInsert, 'id'>>>;

/** Database or transaction the Entity writers run against */
export type Writer = Pick<PostgresJsDatabase<Record<string, unknown>>, 'insert' | 'update' | 'delete'>;

/** Channels of every Entity as a JSON array - left join against core_entity.id */
export function channelsSubquery(pool: Pick<PostgresJsDatabase<Record<string, unknown>>, 'select'>) {
    return pool
        .select({
            entity: CoreEntityChannel.entity,
            channels: sql`JSON_AGG(core_entity_channel.channel::BIGINT ORDER BY core_entity_channel.channel::BIGINT)`.as('channels'),
        })
        .from(CoreEntityChannel)
        .groupBy(CoreEntityChannel.entity)
        .as('channels');
}

/** core_entity WHERE fragment matching Entities shared with any of the given Channels */
export function sharedWith(channels: number[]): SQL {
    if (!channels.length) return sql`False`;

    return sql`EXISTS (
        SELECT 1
        FROM core_entity_channel
        WHERE core_entity_channel.entity = core_entity.id
        AND core_entity_channel.channel IN ${channels}
    )`;
}

/** Replace the Channels an Entity is shared with */
export async function setChannels(tx: Writer, id: string, channels: number[]): Promise<void> {
    await tx.delete(CoreEntityChannel).where(eq(CoreEntityChannel.entity, id));

    if (channels.length) {
        await tx.insert(CoreEntityChannel).values(channels.map(channel => ({ entity: id, channel: BigInt(channel) })));
    }
}

/** Split a flat set of values into the core_entity half & the side table half - side names the side table's columns */
export function splitEntity(values: Record<string, unknown>, side: Set<string>): { entity: Record<string, unknown>; side: Record<string, unknown> } {
    const split = { entity: {} as Record<string, unknown>, side: {} as Record<string, unknown> };

    for (const [key, value] of Object.entries(values)) {
        if (value === undefined) continue;
        (side.has(key) ? split.side : split.entity)[key] = value;
    }

    return split;
}

export function splitEvent(values: Record<string, unknown>): { entity: Record<string, unknown>; event: Record<string, unknown> } {
    const { entity, side } = splitEntity(values, EVENT_KEYS);
    return { entity, event: side };
}

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
            WHERE core_entity_channel.entity = core_entity.id
        )
    ) brd
), '[]'::JSON)`;

/** An Event is active until its ended time - a future ended keeps it active until then */
export const ACTIVE = sql<boolean>`(${CoreEntityEvent.ended} IS NULL OR ${CoreEntityEvent.ended} > Now())`;

export default class CoreEntityModel extends Modeler<typeof CoreEntity> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, CoreEntity);
    }

    /** Create an Event across core_entity & core_entity_event - returns the new id */
    async generateEvent(values: CoreEntityEventInsert, tx: Writer = this.pool): Promise<string> {
        const { entity, event } = splitEvent(values);

        const [row] = await tx.insert(CoreEntity)
            .values({ ...entity, kind: LayerMapping_Destination.COREENTITY } as PgInsertValue<typeof CoreEntity>)
            .returning({ id: CoreEntity.id });

        await tx.insert(CoreEntityEvent).values({ ...event, id: row.id });

        return row.id;
    }

    /** Update an Event across core_entity & core_entity_event - core_entity.updated is always touched */
    async commitEvent(id: string, values: CoreEntityEventUpdate, tx: Writer = this.pool): Promise<void> {
        const { entity, event } = splitEvent(values);

        const updated = await tx.update(CoreEntity)
            .set({ ...entity, updated: sql`Now()` })
            .where(eq(CoreEntity.id, id))
            .returning({ id: CoreEntity.id });

        if (!updated.length) throw new Err(404, null, 'Item Not Found');

        if (Object.keys(event).length) {
            await tx.update(CoreEntityEvent)
                .set(event)
                .where(eq(CoreEntityEvent.id, id));
        }
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof CoreEntityResponse>> {
        const SubTable = channelsSubquery(this.pool);

        const pgres = await this.pool
            .select({
                event: { ...EntityColumns, ...EventColumns },
                active: ACTIVE.as('active'),
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
                boards: BOARDS.as('boards'),
            })
            .from(CoreEntity)
            .innerJoin(CoreEntityEvent, eq(CoreEntity.id, CoreEntityEvent.id))
            .leftJoin(SubTable, eq(CoreEntity.id, SubTable.entity))
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

        const SubTable = channelsSubquery(this.pool);

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                event: { ...EntityColumns, ...EventColumns },
                active: ACTIVE.as('active'),
                channels: sql`COALESCE(${SubTable.channels}, '[]'::JSON)`.as('channels'),
                boards: (query.boards === false ? sql`'[]'::JSON` : BOARDS).as('boards'),
            })
            .from(CoreEntity)
            .innerJoin(CoreEntityEvent, eq(CoreEntity.id, CoreEntityEvent.id))
            .leftJoin(SubTable, eq(CoreEntity.id, SubTable.entity))
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
