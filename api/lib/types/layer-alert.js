import Err from '@openaddresses/batch-error';
import Generic, { Params } from '@openaddresses/batch-generic';
import { sql } from 'slonik';

export default class Layer extends Generic {
    static _table = 'layer_alerts';

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
                RETURNING *
            `);

            return this.deserialize(pool, pgres);
        } catch (err) {
            console.error(err);
            throw new Err(500, new Error(err), `Failed to generate ${this._table}`);
        }
    }
}
