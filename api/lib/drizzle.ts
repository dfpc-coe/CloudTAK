import { sql, eq } from 'drizzle-orm';
import { pgTable, PgTableWithColumns } from 'drizzle-orm/pg-core';
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

    async list(query: {
        limit?: number
        page?: number
    }): Promise<GenericList<T>> {
        const pgres = await this.pool.select({
            count: sql<number>`count(*) OVER()`.as('count'),
            generic: this.generic
        }).from(this.generic)
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
        let primaryKey;
        for (const key in this.generic) {
            if (this.generic[key].primary) primaryKey = this.generic[key];
        }

        if (!primaryKey) throw new Err(500, null, `Cannot use from ${this.generic.name}#from without primaryKey`);
        const generic = await this.pool.query[this.generic.name].findFirst({
            where: eq(primaryKey, id)
        });

        if (!generic) throw new Err(404, null, `${this.generic.name} Not Found`);

        return generic as T;
    }

    async commit(id: unknown, values: object): Promise<T> {
        let primaryKey;
        for (const key in this.generic) {
            if (this.generic[key].primary) primaryKey = this.generic[key];
        }
        if (!primaryKey) throw new Err(500, null, `Cannot use from ${this.generic.name}#from without primaryKey`);

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
        let primaryKey;
        for (const key in this.generic) {
            if (this.generic[key].primary) primaryKey = this.generic[key];
        }
        if (!primaryKey) throw new Err(500, null, `Cannot use from ${this.generic.name}#from without primaryKey`);
        const generic = await this.pool.delete(this.generic)
            .where(eq(primaryKey, id))
    }
}
