import Err from '@openaddresses/batch-error';
import Generic, { Params } from '@openaddresses/batch-generic';
import { sql } from 'slonik';

export default class Data extends Generic {
    static _table = 'data';

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
                    data.*,
                    data_mission.id IS NOT NULL AS mission
                FROM
                    ${sql.identifier([this._table])}
                        LEFT JOIN
                            data_mission ON data.id = data_mission.data
                WHERE
                    name ~* ${query.filter}
                    AND (${query.connection}::BIGINT IS NULL OR connection = ${query.connection}::BIGINT)
                ORDER BY
                    id DESC
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres, 'data');
        } catch (err) {
            throw new Err(500, err, 'Failed to list data sources');
        }
    }
}
