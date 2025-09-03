import Modeler, { GenericList, GenericCountInput, GenericIterInput, GenericListInput } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { jsonBuildObject } from './utils.js';
import { StyleContainer } from '../style.js';
import { FilterContainer } from '../filter.js';
import { Layer_Priority } from '../enums.js';
import { Static, Type } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Connection, Layer, LayerIncoming, LayerOutgoing } from '../schema.js';
import { sql, eq, asc, desc, is, SQL } from 'drizzle-orm';

export const Layer_Config = Type.Object({
    timezone: Type.Optional(Type.Object({
        timezone: Type.String()
    }))
});

export const AugmentedLayerOutgoing = Type.Object({
    layer: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
    environment: Type.Any(),
    ephemeral: Type.Record(Type.String(), Type.Any()),
    filters: FilterContainer,
})

export const AugmentedLayerIncoming = Type.Object({
    layer: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
    config: Layer_Config,
    cron: Type.Union([Type.String(), Type.Null()]),
    webhooks: Type.Boolean(),
    enabled_styles: Type.Boolean(),
    styles: StyleContainer,
    stale: Type.Integer(),
    environment: Type.Any(),
    ephemeral: Type.Record(Type.String(), Type.Any()),
    data: Type.Union([Type.Integer(), Type.Null()])
})

export const AugmentedLayer = Type.Object({
    id: Type.Integer(),
    status: Type.Optional(Type.String()),
    created: Type.String(),
    updated: Type.String(),
    template: Type.Boolean(),
    connection: Type.Union([Type.Null(), Type.Integer()]),
    username: Type.Union([Type.Null(), Type.String()]),
    uuid: Type.String(),
    name: Type.String(),
    description: Type.String(),
    enabled: Type.Boolean(),
    logging: Type.Boolean(),
    task: Type.String(),
    memory: Type.Integer(),
    timeout: Type.Integer(),
    priority: Type.Enum(Layer_Priority),

    alarm_period: Type.Integer(),
    alarm_evals: Type.Integer(),
    alarm_points: Type.Integer(),

    parent: Type.Optional(Type.Object({
        id: Type.Integer(),
        name: Type.String(),
        enabled: Type.Boolean()
    })),

    incoming: Type.Optional(AugmentedLayerIncoming),
    outgoing: Type.Optional(AugmentedLayerOutgoing)
});

export default class LayerModel extends Modeler<typeof Layer> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Layer);
    }

    async tasks(): Promise<string[]> {
        const pgres = await this.pool
            .select({
                task: Layer.task
            })
            .from(Layer)

        if (pgres.length === 0) {
            return []
        } else {
            const taskSet: Set<string> = new Set();
            for (const t of pgres) {
                taskSet.add(t.task.replace(/-v\d+\.\d+\.\d+/, ''))
            }

            return Array.from(taskSet);
        }
    }

    parse(l: Static<typeof AugmentedLayer>): Static<typeof AugmentedLayer> {
        if (l.incoming && l.incoming.layer) {
            if (typeof l.incoming.config === 'string') l.incoming.config = JSON.parse(l.incoming.config)
            if (typeof l.incoming.styles === 'string') l.incoming.styles = JSON.parse(l.incoming.styles)
            if (typeof l.incoming.ephemeral === 'string') l.incoming.ephemeral = JSON.parse(l.incoming.ephemeral)
            if (typeof l.incoming.environment === 'string') l.incoming.environment = JSON.parse(l.incoming.environment)
        } else {
            delete l.incoming;
        }

        if (l.outgoing && l.outgoing.layer) {
            if (typeof l.outgoing.ephemeral === 'string') l.outgoing.ephemeral = JSON.parse(l.outgoing.ephemeral)
            if (typeof l.outgoing.environment === 'string') l.outgoing.environment = JSON.parse(l.outgoing.environment)
            if (typeof l.outgoing.filters === 'string') l.outgoing.filters = JSON.parse(l.outgoing.filters)
        } else {
            delete l.outgoing;
        }

        return l
    }

    async *augmented_iter(query: GenericIterInput = {}): AsyncGenerator<Static<typeof AugmentedLayer>> {
        const pagesize = query.pagesize || 100;
        let page = 0;

        let pgres;
        do {
            pgres = await this.augmented_list({
                page,
                limit: pagesize,
                order: query.order,
                where: query.where
            });

            for (const row of pgres.items) {
                yield row as Static<typeof AugmentedLayer>
            }

            page++;
        } while (pgres.items.length);
    }

    async augmented_from(id: unknown | SQL<unknown>): Promise<Static<typeof AugmentedLayer>> {
        const pgres = await this.pool
            .select({
                id: Layer.id,
                uuid: Layer.uuid,
                priority: Layer.priority,
                created: Layer.created,
                updated: Layer.updated,
                username: Layer.username,
                name: Layer.name,
                description: Layer.description,
                enabled: Layer.enabled,
                logging: Layer.logging,
                task: Layer.task,
                template: Layer.template,
                connection: Layer.connection,
                memory: Layer.memory,
                timeout: Layer.timeout,

                alarm_period: Layer.alarm_period,
                alarm_evals: Layer.alarm_evals,
                alarm_points: Layer.alarm_points,

                parent: jsonBuildObject({
                    id: Connection.id,
                    name: Connection.name,
                    enabled: Connection.enabled
                }),

                incoming: jsonBuildObject({
                    layer: LayerIncoming.layer,
                    created: LayerIncoming.created,
                    updated: LayerIncoming.updated,
                    cron: LayerIncoming.cron,
                    stale: LayerIncoming.stale,
                    webhooks: LayerIncoming.webhooks,
                    environment: LayerIncoming.environment,
                    ephemeral: LayerIncoming.ephemeral,
                    config: LayerIncoming.config,
                    data: LayerIncoming.data,
                    enabled_styles: LayerIncoming.enabled_styles,
                    styles: LayerIncoming.styles,
                }),

                outgoing: jsonBuildObject({
                    layer: LayerOutgoing.layer,
                    created: LayerOutgoing.created,
                    updated: LayerOutgoing.updated,
                    environment: LayerOutgoing.environment,
                    ephemeral: LayerOutgoing.ephemeral,
                    filters: LayerOutgoing.filters,
                })
            })
            .from(Layer)
            .leftJoin(Connection, eq(Layer.connection, Connection.id))
            .leftJoin(LayerIncoming, eq(LayerIncoming.layer, Layer.id))
            .leftJoin(LayerOutgoing, eq(LayerOutgoing.layer, Layer.id))
            .where(is(id, SQL)? id as SQL<unknown> : eq(this.requiredPrimaryKey(), id))
            .limit(1)

        if (pgres.length !== 1) throw new Err(404, null, `Item Not Found`);

        return this.parse(pgres[0] as Static<typeof AugmentedLayer>);
    }

    async augmented_count(query: GenericCountInput = {}): Promise<number> {
        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
            })
            .from(Layer)
            .leftJoin(LayerIncoming, eq(LayerIncoming.layer, Layer.id))
            .leftJoin(LayerOutgoing, eq(LayerOutgoing.layer, Layer.id))
            .where(query.where)

        return pgres.length ? Number(pgres[0].count) : 0;
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof AugmentedLayer>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                id: Layer.id,
                uuid: Layer.uuid,
                priority: Layer.priority,
                created: Layer.created,
                updated: Layer.updated,
                username: Layer.username,
                name: Layer.name,
                description: Layer.description,
                enabled: Layer.enabled,
                logging: Layer.logging,
                task: Layer.task,
                template: Layer.template,
                connection: Layer.connection,
                memory: Layer.memory,
                timeout: Layer.timeout,

                alarm_period: Layer.alarm_period,
                alarm_evals: Layer.alarm_evals,
                alarm_points: Layer.alarm_points,

                parent: jsonBuildObject({
                    id: Connection.id,
                    name: Connection.name,
                    enabled: Connection.enabled
                }),

                incoming: jsonBuildObject({
                    layer: LayerIncoming.layer,
                    created: LayerIncoming.created,
                    updated: LayerIncoming.updated,
                    cron: LayerIncoming.cron,
                    stale: LayerIncoming.stale,
                    webhooks: LayerIncoming.webhooks,
                    environment: LayerIncoming.environment,
                    ephemeral: LayerIncoming.ephemeral,
                    config: LayerIncoming.config,
                    data: LayerIncoming.data,
                    enabled_styles: LayerIncoming.enabled_styles,
                    styles: LayerIncoming.styles,
                }),

                outgoing: jsonBuildObject({
                    layer: LayerOutgoing.layer,
                    created: LayerOutgoing.created,
                    updated: LayerOutgoing.updated,
                    environment: LayerOutgoing.environment,
                    ephemeral: LayerOutgoing.ephemeral,
                    filters: LayerOutgoing.filters,
                })
            })
            .from(Layer)
            .leftJoin(Connection, eq(Layer.connection, Connection.id))
            .leftJoin(LayerIncoming, eq(LayerIncoming.layer, Layer.id))
            .leftJoin(LayerOutgoing, eq(LayerOutgoing.layer, Layer.id))
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10))

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                total: parseInt(pgres[0].count),
                items: pgres.map((t) => {
                    return this.parse(t as Static<typeof AugmentedLayer>);
                })
            };
        }
    }
}
