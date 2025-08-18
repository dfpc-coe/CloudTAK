import Modeler, { GenericList, GenericListInput } from '@openaddresses/batch-generic';
import { Static, Type } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Connection, Data } from '../schema.js';
import { sql, eq, asc, desc } from 'drizzle-orm';

export const AugmentedData = Type.Object({
    id: Type.Integer(),
    created: Type.String(),
    updated: Type.String(),
    username: Type.Union([Type.Null(), Type.String()]),
    name: Type.String(),
    mission_diff: Type.Boolean({description: "Allow a single layer to diff sync with TAK Server"}),
    mission_sync: Type.Boolean({description: "Is the mission syncing with TAK Server"}),
    mission_exists: Type.Optional(Type.Boolean({description: "Does the mission exist in TAK Server"})),
    mission_error: Type.Optional(Type.String({ description: "Returned only if there is an error syncing the mission with the TAK Server"})),
    mission_groups: Type.Array(Type.String()),
    mission_role: Type.String(),
    assets: Type.Array(Type.String()),
    description: Type.String(),
    connection: Type.Integer(),
});

export default class DataModel extends Modeler<typeof Data> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Data);
    }

    async augmented_list(query: GenericListInput = {}): Promise<GenericList<Static<typeof AugmentedData>>> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const pgres = await this.pool
            .select({
                count: sql<string>`count(*) OVER()`.as('count'),
                id: Data.id,
                created: Data.created,
                updated: Data.updated,
                username: Data.username,
                name: Data.name,
                description: Data.description,
                connection: Data.connection,
                mission_sync: Data.mission_sync,
                assets: Data.assets,
                mission_groups: Data.mission_groups,
                mission_role: Data.mission_role,
                mission_token: Data.mission_token,
                mission_diff: Data.mission_diff
            })
            .from(Data)
            .leftJoin(Connection, eq(Connection.id, Data.connection))
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
                    return {
                        ...t,
                        count: undefined
                    } as Static<typeof AugmentedData>
                })
            };
        }
    }
}
