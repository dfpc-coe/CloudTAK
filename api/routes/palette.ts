import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { Palette } from '../lib/schema.js';
import { PaletteResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/palette', {
        name: 'List Palettes',
        group: 'Palette',
        description: 'List Palette',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({ default: 'created', enum: Object.keys(Palette) }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(PaletteResponse)
        })
    }, async (req, res) => {
        try {
            const list = await config.models.Palette.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                `
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
