import Generic, { Params } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { sql } from 'slonik';

/**
 * @class
 */
export default class Connection extends Generic {
    static _table = 'connection_sinks';

    static async list(pool, query={}) {
        query.limit = Params.integer(query.limit, { default: 100 });
        query.page = Params.integer(query.page, { default: 0 });
        query.sort = Params.string(query.sort, { default: 'created' });
        query.order = Params.order(query.order);
        query.filter = Params.string(query.filter, { default: '' });
        query.connection = Params.integer(query.connection);

        try {
            const pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    *
                FROM
                    ${sql.identifier([this._table])}
                WHERE
                    name ~* ${query.filter}
                    AND connection = ${query.connection}
                ORDER BY
                    id DESC
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres, 'sinks');
        } catch (err) {
            throw new Err(500, err, 'Failed to list connection sink');
        }
    }

}
