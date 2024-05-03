import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { StyleContainer } from '../style.js';
import { Layer_Priority } from '../enums.js';
import { Static, Type } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Connection, Layer } from '../schema.js';
import { sql, eq, asc, desc } from 'drizzle-orm';

export const Layer_Config = Type.Object({
    timezone: Type.Optional(Type.Object({
        timezone: Type.String()
    }))
});

export const AugmentedLayer = Type.Object({
    id: Type.Integer(),
    status: Type.Optional(Type.String()),
    priority: Type.Enum(Layer_Priority),
    created: Type.String(),
    updated: Type.String(),
    name: Type.String(),
    description: Type.String(),
    enabled: Type.Boolean(),
    enabled_styles: Type.Boolean(),
    styles: StyleContainer,
    logging: Type.Boolean(),
    stale: Type.Integer(),
    task: Type.String(),
    connection: Type.Optional(Type.Integer()),
    cron: Type.String(),
    environment: Type.Any(),
    config: Layer_Config,
    memory: Type.Integer(),
    timeout: Type.Integer(),
    data: Type.Optional(Type.Integer()),
    schema: Type.Any()
});

export default class LayerModel extends Modeler<typeof Layer> {
    constructor(
        pool: PostgresJsDatabase<any>,
    ) {
        super(pool, Layer);
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof AugmentedLayer>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                id: Layer.id,
                priority: Layer.priority,
                created: Layer.created,
                updated: Layer.updated,
                name: Layer.name,
                description: Layer.description,
                enabled: Layer.enabled,
                enabled_styles: Layer.enabled_styles,
                styles: Layer.styles,
                logging: Layer.logging,
                stale: Layer.stale,
                task: Layer.task,
                connection: Layer.connection,
                cron: Layer.cron,
                environment: Layer.environment,
                config: Layer.config,
                memory: Layer.memory,
                timeout: Layer.timeout,
                data: Layer.data,
                schema: Layer.schema
            })
            .from(Layer)
            .leftJoin(Connection, eq(Connection.id, Layer.connection))
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
                    delete t.count;
                    return t as Static<typeof AugmentedLayer>
                })
            };
        }
    }
}
