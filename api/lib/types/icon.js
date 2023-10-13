import Generic, { Params } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { sql } from 'slonik';

/**
 * @class
 */
export default class Icon extends Generic {
    static _table = 'icons';

    static async list(pool, query={}) {
        query.limit = Params.integer(query.limit, { default: 100 });
        query.page = Params.integer(query.page, { default: 0 });
        query.sort = Params.string(query.sort, { default: 'created' });
        query.order = Params.order(query.order);
        query.filter = Params.string(query.filter, { default: '' });

        try {
            const pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    *
                FROM
                    ${sql.identifier([this._table])}
                WHERE
                    name ~* ${query.filter}
                ORDER BY
                    ${sql.identifier([this._table, query.sort])} ${query.order}
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres);
        } catch (err) {
            throw new Err(500, err, 'Failed to list iconsets');
        }
    }

    static async from(pool, iconset, name) {
        try {
            const pgres = await pool.query(sql`
                SELECT
                    *
                FROM
                    ${sql.identifier([this._table])}
                WHERE
                    name = ${name}
                    AND iconset = ${iconset}
            `);

            return this.deserialize(pgres);
        } catch (err) {
            throw new Err(500, err, 'Failed to get icon');
        }
    }

}
