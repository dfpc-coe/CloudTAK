import Err from '@openaddresses/batch-error';
import Generic, { Params } from '@openaddresses/batch-generic';
import { sql } from 'slonik';

export default class Layer extends Generic {
    static _table = 'layers';

    static async list(pool, query={}) {
        query.limit = Params.integer(query.limit, { default: 100 });
        query.page = Params.integer(query.page, { default: 0 });
        query.sort = Params.string(query.sort, { default: 'created' });
        query.order = Params.order(query.order);
        query.filter = Params.string(query.filter, { default: '' });

        query.connection = Params.integer(query.connection);
        query.mode = Params.string(query.mode);

        try {
            const pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    layers.*
                FROM
                    ${sql.identifier([this._table])}
                        LEFT JOIN layers_live
                            ON layers.id = layers_live.layer_id
                WHERE
                    name ~* ${query.filter}
                    AND (${query.mode}::TEXT IS NULL OR ${query.mode}::TEXT = mode)
                    AND (${query.connection}::BIGINT IS NULL OR ${query.connection}::BIGINT = layers_live.connection)
                ORDER BY
                    id DESC
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres, 'layers');
        } catch (err) {
            throw new Err(500, err, 'Failed to list layers');
        }
    }
}
