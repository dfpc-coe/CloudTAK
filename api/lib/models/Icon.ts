import Modeler, { GenericListInput } from '@openaddresses/batch-generic';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as pgschema from '../schema.js';
import { sql, eq, asc, desc } from 'drizzle-orm';

export type Icon = {
    id: number;
    created: string;
    updated: string;
    name: string;
    format: string;
    iconset: string;
    type2525b: string;
    data: string;
    path: string;
    username: string;
}

export type IconList = {
    total: number;
    items: Array<Icon>
}

export default class IconModel extends Modeler<typeof pgschema.Icon> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, pgschema.Icon);
    }

    async list(query: GenericListInput = {}): Promise<IconList> {
        const order = query.order && query.order === 'desc' ? desc : asc;
        const orderBy = order(query.sort ? this.key(query.sort) : this.requiredPrimaryKey());

        const pgres = await this.pool.select({
            count: sql<string>`count(*) OVER()`.as('count'),
            id: pgschema.Icon.id,
            created: pgschema.Icon.created,
            updated: pgschema.Icon.updated,
            name: pgschema.Icon.name,
            format: pgschema.Icon.format,
            iconset: pgschema.Icon.iconset,
            type2525b: pgschema.Icon.type2525b,
            data: pgschema.Icon.data,
            path: pgschema.Icon.path,
            username: pgschema.Iconset.username
        }).from(this.generic)
            .leftJoin(pgschema.Iconset, eq(pgschema.Iconset.uid, pgschema.Icon.iconset))
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
                    return t as Icon;
                })
            };
        }
    }
}
