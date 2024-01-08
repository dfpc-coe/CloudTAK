import {
    sql,
    eq,
    asc,
    desc,
    SQL
} from 'drizzle-orm';
import { pgTable, PgColumn, PgTableWithColumns } from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Err from '@openaddresses/batch-error';

export interface GenericList<T> {
    total: number;
    items: Array<T>
}

export default class Drizzle<T> {
    generic: PgTableWithColumns<any>;
    pool: PostgresJsDatabase<typeof import("/home/null/Development/dfpc-coe/etl/api/lib/schema")>;

    constructor(
        pool: PostgresJsDatabase<typeof import("/home/null/Development/dfpc-coe/etl/api/lib/schema")>,
        generic: PgTableWithColumns<any>
    ) {
        this.pool = pool;
        this.generic = generic;
    }

    #primaryKey(required = false): PgColumn | null {
        let primaryKey;
        for (const key in this.generic) {
            if (this.generic[key].primary) primaryKey = this.generic[key];
        }

        if (required && !primaryKey) throw new Err(500, null, `Cannot access ${this.generic.name} without primaryKey`);

        return primaryKey || null;
    }

    #key(key: string): PgColumn {
        if (this.generic[key]) return this.generic[key];
        throw new Err(500, null, `Cannot access ${this.generic.name}.${key} as it does not exist`);
    }

    async list(query: {
        limit?: number;
        page?: number;
        order?: string;
        sort?: string;
        where?: SQL<unknown>;
    }): Promise<GenericList<T>> {
        const order = query.sort && query.sort === 'asc' ? asc : desc;
        const orderBy = order(query.sort ? this.#key(query.sort) : this.#primaryKey());

        const pgres = await this.pool.select({
            count: sql<number>`count(*) OVER()`.as('count'),
            generic: this.generic
        }).from(this.generic)
            .where(query.where)
            .orderBy(orderBy)
            .limit(query.limit || 10)
            .offset(query.page || 0)

        if (pgres.length === 0) {
            return { total: 0, items: [] };
        } else {
            return {
                total: pgres[0].count,
                items: pgres.map((t) => { return t.generic as T })
            };
        }
    }

    async from(id: unknown): Promise<T> {
        const primaryKey = this.#primaryKey(true);

        const generic = await this.pool.query[this.generic.name].findFirst({
            where: eq(primaryKey, id)
        });

        if (!generic) throw new Err(404, null, `${this.generic.name} Not Found`);

        return generic as T;
    }

    async commit(id: unknown, values: object): Promise<T> {
        const primaryKey = this.#primaryKey(true);

        const generic = await this.pool.update(this.generic)
            .set(values)
            .where(eq(primaryKey, id))
            .returning();

        return generic as T;
    }

    async generate(values: object): Promise<T> {
        const generic = await this.pool.insert(this.generic)
            .values(values)
            .returning();

        return generic as T;
    }

    async delete(id: unknown): Promise<void> {
        const primaryKey = this.#primaryKey(true);

        const generic = await this.pool.delete(this.generic)
            .where(eq(primaryKey, id))
    }
}
