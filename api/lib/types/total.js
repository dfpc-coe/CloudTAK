import Generic from '@openaddresses/batch-generic';
import { Params } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { sql } from 'slonik';

/**
 * @class
 */
export default class Total extends Generic {
    static _table = 'total';

    static async list(pool, query={}) {
        query.sort = Params.string(query.sort, { default: 'dt' });
        query.order = Params.order(query.order);

        query.after = Params.timestamp(query.after);
        query.before = Params.timestamp(query.before);

        try {
            const pgres = await pool.query(sql`
                SELECT
                    dt,
                    count
                FROM
                    total
                WHERE
                    (${query.before}::TIMESTAMP IS NULL OR dt < ${query.before}::TIMESTAMP)
                    AND (${query.after}::TIMESTAMP IS NULL OR dt > ${query.after}::TIMESTAMP)
                ORDER BY
                    ${sql.identifier(['total', query.sort])} ${query.order}
            `);

            return {
                totals: pgres.rows
            }
        } catch (err) {
            throw new Err(500, err, 'Failed to list totals');
        }
    }
}
