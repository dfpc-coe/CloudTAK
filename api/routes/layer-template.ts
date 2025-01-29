import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { StandardResponse, LayerTemplateResponse } from '../lib/types.js';
import { LayerTemplate } from '../lib/schema.js';
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
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(LayerTemplate)})),
            filter: Default.Filter,
            data: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(LayerTemplateResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.LayerTemplate.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
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
        res: LayerTemplateResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const template = await config.models.LayerTemplate.from(req.params.templateid);

            res.json(template)
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/template/:templateid', {
        name: 'Update Template',
        group: 'LayerTemplate',
        description: 'Update a layer template',
        params: Type.Object({
            templateid: Type.Integer()
        }),
        body: Type.Object({
            name: Default.NameField,
            description: Default.DescriptionField,
            datasync: Type.Optional(Type.Boolean({ default: true })),
        }),
        res: LayerTemplateResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const template = await config.models.LayerTemplate.commit(req.params.templateid, {
                ...req.body,
                updated: sql<string>`Now()`,
            });

            res.json(template)
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/template/:templateid', {
        name: 'Create Template',
        group: 'LayerTemplate',
        description: 'Create a layer template',
        params: Type.Object({
            templateid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            await config.models.LayerTemplate.delete(req.params.templateid);

            res.json({
                status: 200,
                message: 'Layer Template Deleted'
            })
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.post('/template', {
        name: 'Create Template',
        group: 'LayerTemplate',
        description: 'Create a layer template',
        body: Type.Object({
            name: Default.NameField,
            description: Default.DescriptionField,
            datasync: Type.Optional(Type.Boolean({ default: true })),
            layer: Type.Integer()
        }),
        res: LayerTemplateResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req, { admin: true });

            const layer = await config.models.Layer.augmented_from(req.body.layer);

            const template = await config.models.LayerTemplate.generate({
                ...layer,
                username: user.email,
                ...req.body,
            });

            res.json(template)
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
