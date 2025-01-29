import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { jsonBuildObject } from './utils.js';
import { StyleContainer } from '../style.js';
import { Layer_Priority } from '../enums.js';
import { Static, Type } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Connection, Layer, LayerIncoming } from '../schema.js';
import { sql, eq, asc, desc } from 'drizzle-orm';

export const Layer_Config = Type.Object({
    timezone: Type.Optional(Type.Object({
        timezone: Type.String()
    }))
});

export const AugmentedLayer = Type.Object({
    id: Type.Integer(),
    status: Type.Optional(Type.String()),
    created: Type.String(),
    updated: Type.String(),
    uuid: Type.String(),
    name: Type.String(),
    description: Type.String(),
    enabled: Type.Boolean(),
    logging: Type.Boolean(),
    task: Type.String(),
    connection: Type.Optional(Type.Integer()),
    memory: Type.Integer(),
    timeout: Type.Integer(),
    priority: Type.Enum(Layer_Priority),

    incoming: Type.Optional(Type.Object({
        cron: Type.Union([Type.String(), Type.Null()]),
        webhooks: Type.Boolean(),
        alarm_period: Type.Integer(),
        alarm_evals: Type.Integer(),
        alarm_points: Type.Integer(),
        alarm_threshold: Type.Integer(),
        enabled_styles: Type.Boolean(),
        styles: StyleContainer,
        stale: Type.Integer(),
        environment: Type.Any(),
        ephemeral: Type.Record(Type.String(), Type.String()),
        config: Layer_Config,
        data: Type.Union([Type.Integer(), Type.Null()]),
        schema: Type.Any(),
    }))
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
                name: Layer.name,
                description: Layer.description,
                enabled: Layer.enabled,
                logging: Layer.logging,
                task: Layer.task,
                connection: Layer.connection,
                memory: Layer.memory,
                timeout: Layer.timeout,

                incoming: jsonBuildObject({
                    cron: LayerIncoming.cron,
                    stale: LayerIncoming.stale,
                    webhooks: LayerIncoming.webhooks,
                    alarm_period: LayerIncoming.alarm_period,
                    alarm_evals: LayerIncoming.alarm_evals,
                    alarm_points: LayerIncoming.alarm_points,
                    alarm_threshold: LayerIncoming.alarm_threshold,
                    environment: LayerIncoming.environment,
                    ephemeral: LayerIncoming.ephemeral,
                    config: LayerIncoming.config,
                    data: LayerIncoming.data,
                    schema: LayerIncoming.schema,
                    enabled_styles: LayerIncoming.enabled_styles,
                    styles: LayerIncoming.styles,
                })
            })
            .from(Layer)
            .leftJoin(Connection, eq(Connection.id, Layer.connection))
            .leftJoin(Layer, eq(LayerIncoming.layer, Layer.id))
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset((query.page || 0) * (query.limit || 10))

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                // @ts-expect-error never type
                total: parseInt(pgres[0].count),
                items: pgres.map((t) => {
                    return t as Static<typeof AugmentedLayer>
                })
            };
        }
    }
}
