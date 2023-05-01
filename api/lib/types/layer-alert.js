import Err from '@openaddresses/batch-error';
import Generic, { Params } from '@openaddresses/batch-generic';
import { sql } from 'slonik';

export default class Layer extends Generic {
    static _table = 'layer_alerts';

    static async list(pool, layerid, query={}) {
        query.limit = Params.integer(query.limit, { default: 100 });
        query.page = Params.integer(query.page, { default: 0 });
        query.sort = Params.string(query.sort, { default: 'created' });
        query.order = Params.order(query.order);
        query.filter = Params.string(query.filter, { default: '' });

        layerid = Params.integer(layerid);

        try {
            const pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    layer_alerts.*
                FROM
                    ${sql.identifier([this._table])}
                WHERE
                    layer = ${layerid}
                    AND title ~* ${query.filter}
                ORDER BY
                    id DESC
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres, 'alerts');
        } catch (err) {
            throw new Err(500, err, 'Failed to list Layer Alerts');
        }
    }

    static async generate(pool, body) {
        try {
            const pgres = await pool.query(sql`
                INSERT INTO layer_alerts (
                    layer,
                    icon,
                    priority,
                    title,
                    description
                ) VALUES (
                    ${body.layer},
                    ${body.icon},
                    ${body.priority},
                    ${body.title},
                    ${body.description}
                ) ON CONFLICT (layer, title)
                    DO UPDATE
                        SET
                            layer = ${body.layer},
                            icon = ${body.icon},
                            priority = ${body.priority},
                            title = ${body.title},
                            description = ${body.description}
            `);

            return this.deserialize(pool, pgres);
        } catch (err) {
            console.error(err);
            throw new Err(500, new Error(err), `Failed to generate ${this._table}`);
        }
    }
}
