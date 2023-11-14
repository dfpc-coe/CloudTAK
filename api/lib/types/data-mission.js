import Err from '@openaddresses/batch-error';
import Generic, { Params } from '@openaddresses/batch-generic';
import { sql } from 'slonik';

export default class DataMission extends Generic {
    static _table = 'data_mission';

    static async list(pool, query={}) {
        query.limit = Params.integer(query.limit, { default: 100 });
        query.page = Params.integer(query.page, { default: 0 });
        query.sort = Params.string(query.sort, { default: 'name' });
        query.order = Params.order(query.order);
        query.filter = Params.string(query.filter, { default: '' });

        try {
            const pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    data_mission.*
                FROM
                    ${sql.identifier([this._table])}
                WHERE
                    name ~* ${query.filter}
                ORDER BY
                    id DESC
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres, 'missions');
        } catch (err) {
            throw new Err(500, err, 'Failed to list data missions');
        }
    }
}
