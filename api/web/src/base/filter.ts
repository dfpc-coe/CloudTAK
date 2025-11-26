import { db } from './database.ts'
import type { Feature } from '../types.ts';
import jsonata from 'jsonata';
import { v4 as randomUUID } from 'uuid';

/**
 * High Level Wrapper around the Data Filters
 *
 * TODO: Once all COTs are in IndexDB, apply the filter on to a new field in the COT
 * called "filtered": [ <filterid>, ... ] so we don't have to re-evaluate the filter each time
 *
 * @property {string} id - The unique identifier for the filter
 * @property {string} external - The external ID of the filter
 * @property {string} name - The name of the filter
 * @property {string} source - The source of the filter
 * @property {boolean} internal - Whether the filter is internal
 * @property {string} query - The JSONata query string for the filter
 */
export default class Filter {
    id: string;
    external: string;
    name: string;
    source: string;
    internal: boolean;
    query: string;

    expression: jsonata.Expression;

    constructor(
        name: string,
        external: string,
        source: string,
        internal: boolean,
        query: string
    ) {
        this.id = randomUUID();

        this.name = name;
        this.external = external;
        this.source = source;
        this.internal = internal;
        this.query = query;

        this.expression = jsonata(this.query);
    }

    async test(feature: Feature): Promise<boolean> {
        return await this.expression.evaluate(feature);
    }

    static async list(): Promise<Filter[]> {
        const filters = await db.filter.toArray();

        return filters.map(f => {
            const filter = new Filter(
                f.name,
                f.external,
                f.source,
                f.internal,
                f.query
            );

            filter.id = f.id;

            return filter;
        });
    }

    static async from(
        id: string
    ): Promise<Filter | null> {
        const exists = await db.filter
            .get(id)

        if (!exists) return null;

        const filter = new Filter(
            exists.name,
            exists.external,
            exists.source,
            exists.internal,
            exists.query
        );

        filter.id = exists.id;

        return filter;
    }

    async update(
        body: {
            name?: string;
            external?: string;
            source?: string;
            internal?: boolean;
            query?: string;
        }
    ): Promise<void> {
        if (body.name !== undefined) this.name = body.name;
        if (body.external !== undefined) this.external = body.external;
        if (body.source !== undefined) this.source = body.source;
        if (body.internal !== undefined) this.internal = body.internal;
        if (body.query !== undefined) this.query = body.query;

        await db.filter.update(this.id, {
            name: this.name,
            external: this.external,
            source: this.source,
            internal: this.internal,
            query: this.query,
        });
    }

    static async create(
        name: string,
        external: string,
        source: string,
        internal: boolean,
        query: string
    ): Promise<Filter> {
        const filter = new Filter(
            name,
            external,
            source,
            internal,
            query
        );

        await db.filter.add({
            id: filter.id,
            name: filter.name,
            external: filter.external,
            source: filter.source,
            internal: filter.internal,
            query: filter.query,
        });

        return filter;
    }

    async delete(): Promise<void> {
        await Filter.delete({ id: this.id });
    }

    static async delete(id: {
        id?: string;
        external?: string;
    }): Promise<void> {
        if (!id.id && !id.external) {
            throw new Error('Either id or external must be provided for deletion.');
        } else if (id.id) {
            await db.filter
                .where('id')
                .equals(id.id)
                .delete();
        } else if (id.external) {
            await db.filter
                .where('external')
                .equals(id.external)
                .delete();
        }
    }
}
