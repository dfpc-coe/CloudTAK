import { Type } from '@sinclair/typebox'
import Config from '../lib/config.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { OverlayResponse } from '../lib/types.js'
import { Overlay } from '../lib/schema.js';
import { sql } from 'drizzle-orm';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/overlay', {
        name: 'Get Overlays',
        group: 'Overlays',
        description: 'Return a list of Server Overlays',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            filter: Default.Filter,
            sort: Type.Optional(Type.String({default: 'name', enum: Object.keys(Overlay)})),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(OverlayResponse)
        })

    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const overlays = await config.models.Overlay.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                where: sql`
                    name = ${req.query.filter}
                `
            });

            return res.json(overlays)
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/overlay', {
        name: 'Create Overlays',
        group: 'Overlays',
        description: 'Create a new Server Overlay',
        body: Type.Object({
            name: Type.String(),
            type: Type.String(),
            styles: Type.Object({}),
            url: Type.String()
        }),
        res: OverlayResponse

    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            const overlays = await config.models.Overlay.generate(req.body)

            return res.json(overlays)
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
