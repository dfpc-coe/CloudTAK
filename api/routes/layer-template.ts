import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { Layer } from '../lib/schema.js';
import { LayerResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/template', {
        name: 'List Templates',
        group: 'LayerTemplate',
        description: 'List all layer templates',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Layer)})),
            filter: Default.Filter,
            data: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(LayerResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.Layer.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    layers.name ~* ${req.query.filter}
                    AND template = True
                `
            });

            res.json(list)
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/template/:templateid', {
        name: 'Get Template',
        group: 'LayerTemplate',
        description: 'Return a single Layer Template',
        params: Type.Object({
            templateid: Type.Integer()
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const layer = await config.models.Layer.augmented_from(req.params.templateid);

            if (layer.template === false) {
                throw new Err(400, null, 'Layer is not a Template Layer');
            }

            res.json(layer)
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
