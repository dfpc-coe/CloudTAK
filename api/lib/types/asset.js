import Generic from '@openaddresses/batch-generic';
import { Params } from '@openaddresses/batch-generic';
import Err from '@openaddresses/batch-error';
import { sql } from 'slonik';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

/**
 * Store information about Photo Assets
 * @class
 */
export default class Asset extends Generic {
    static _table = 'assets';

    serialize() {
        const asset = super.serialize();
        asset.asset_url = `/asset/${this.id}${path.parse(this.name).ext}`;
        return asset;
    }

    static async list(pool, query) {
        query.limit = Params.integer(query.limit, { default: 20 });
        query.page = Params.integer(query.page, { default: 0 });
        query.filter = Params.string(query.filter);
        query.sort = Params.string(query.sort, { default: 'created' });
        query.archived = Params.boolean(query.archived);
        query.order = Params.order(query.order);

        try {
            const pgres = await pool.query(sql`
                SELECT
                    count(*) OVER() AS count,
                    id,
                    created,
                    updated,
                    name
                FROM
                    assets
                WHERE
                    (${query.filter}::TEXT IS NULL OR name ~* ${query.filter})
                ORDER BY
                    ${sql.identifier(['assets', query.sort])} ${query.order}
                LIMIT
                    ${query.limit}
                OFFSET
                    ${query.limit * query.page}
            `);

            return this.deserialize_list(pgres);
        } catch (err) {
            throw new Err(500, err, 'Failed to list assets');
        }
    }

    async upload(stream) {
        try {
            await pipeline(
                stream,
                fs.createWriteStream(new URL(`../../assets/${this.id}${path.parse(this.name).ext}`, import.meta.url))
            );

            return this;
        } catch (err) {
            throw new Error(500, err, 'Failed to upload file');
        }
    }
}
