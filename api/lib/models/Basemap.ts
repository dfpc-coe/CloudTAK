import Modeler, { GenericListInput } from '@openaddresses/batch-generic';
import { Static, Type } from '@sinclair/typebox'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Basemap } from '../schema.js';
import { desc } from 'drizzle-orm';

export const BasemapCollection = Type.Object({
    name: Type.String()
});

export default class BasemapModel extends Modeler<typeof Basemap> {
    constructor(
        pool: PostgresJsDatabase<Record<string, unknown>>,
    ) {
        super(pool, Basemap);
    }

    async collections(query: GenericListInput = {}): Promise<Array<Static<typeof BasemapCollection>>> {
        const pgres = await this.pool
            .select({
                name: Basemap.collection
            })
            .from(Basemap)
            .where(query.where)
            .groupBy(Basemap.collection)
            .orderBy(desc(Basemap.collection))

        if (pgres.length === 0) {
            return [] as Array<Static<typeof BasemapCollection>>;
        } else {
            return pgres as Array<Static<typeof BasemapCollection>>;
        }
    }
}
