import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import { Palette } from '../lib/schema.js';
import { PaletteResponse, StandardResponse } from '../lib/types.js';
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
            const list = await config.models.Palette.augmented_list({
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

    await schema.get('/palette/:palette', {
        name: 'Get Palette',
        group: 'Palette',
        description: 'Get Palette',
        params: Type.Object({
            palette: Type.String()
        }),
        res: PaletteResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            res.json(palette);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/palette', {
        name: 'Create Palette',
        group: 'Palette',
        description: 'Create a new editing Palette',
        body: Type.Object({
            name: Type.String()
        }),
        res: PaletteResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            const palette = await config.models.Palette.generate({
                ...req.body,
            });

            res.json(await config.models.Palette.augmented_from(palette.uuid));
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/palette/:palette', {
        name: 'Update Palette',
        group: 'Palette',
        params: Type.Object({
            palette: Type.String(),
        }),
        description: 'Update properties of a Palette',
        body: Type.Object({
            name: Type.Optional(Type.String())
        }),
        res: PaletteResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            await config.models.Palette.commit(req.params.palette, {
                ...req.body
            });

            res.json(await config.models.Palette.augmented_from(req.params.palette));
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/palette/:palette', {
        name: 'Delete Palette',
        group: 'Palette',
        description: 'Delete an editing Palette',
        params: Type.Object({
            palette: Type.String(),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
             await Auth.as_user(config, req, {
                admin: true
            });

            await config.models.Palette.delete(req.params.palette);

            res.json({ status: 200, message: 'Palette Deleted' });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
