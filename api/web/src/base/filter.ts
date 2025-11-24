import { db } from './database.ts'
import { v4 as randomUUID } from 'uuid';

/**
 * High Level Wrapper around the Data Filters
 *
 * @property {string} id - The unique identifier for the filter
 * @property {string} name - The name of the filter
 * @property {string} source - The source of the filter
 * @property {boolean} internal - Whether the filter is internal
 * @property {string} query - The JSONata query string for the filter
 */
export default class Filter {
    id: string;
    name: string;
    source: string;
    internal: boolean;
    query: string;

    constructor(
        name: string,
        source: string,
        internal: boolean,
        query: string
    ) {
        this.id = randomUUID();

        this.name = name;
        this.source = source;
        this.internal = internal;
        this.query = query;
    }

    /**
     * Return a Subscription instance of one already exists in the local DB,
     */
    static async from(
        id: string
    ): Promise<Filter | null> {
        const exists = await db.filter
            .get(guid)

        if (!exists) return null;

        return new Filter(
            exists.name,
            exists.source,
            exists.internal,
            exists.query
        );
    }

    async update(
        body: {
            name?: string;
            source?: string;
            internal?: boolean;
            query?: string;
        }
    ): Promise<void> {
        if (body.name !== undefined) this.name = body.name;
        if (body.source !== undefined) this.source = body.source;
        if (body.internal !== undefined) this.internal = body.internal;
        if (body.query !== undefined) this.query = body.query;

        await db.filter.update(this.id, {
            name: this.name,
            source: this.source,
            internal: this.internal,
            query: this.query,
        });
    }

    async delete(): Promise<void> {
        await db.filter.delete(this.id);
    }
}
