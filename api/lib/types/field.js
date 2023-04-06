import Generic from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { sql } from 'slonik';

/**
 * @class
 */
export default class Total extends Generic {
    static _table = 'fields';

    static async aggregate(pool, field, query={}) {
        if (!field) throw new Error('aggregate field not provided');

        try {
            const pgres = await pool.query(sql`
                SELECT
                    stats
                FROM
                    fields
                WHERE
                    dim = ${field}
                ORDER BY
                    dt DESC
                LIMIT
                    1
            `);

            return pgres.rows[0].stats;
        } catch (err) {
            throw new Err(500, err, 'Failed to aggregate field');
        }
    }

}
