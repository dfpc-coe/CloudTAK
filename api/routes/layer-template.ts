import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import { sql } from 'drizzle-orm';
import { Layer } from '../lib/schema.js';
import LayerControl from '../lib/control/layer.js'
import { LayerResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const layerControl = new LayerControl(config);

    await schema.get('/template', {
        name: 'List Templates',
        group: 'LayerTemplate',
        description: 'List all layer templates',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Layer)
            }),
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
                    AND template = true
                `
            });

            res.json(list)
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/template', {
        name: 'Create Template',
        group: 'LayerTemplate',
        description: 'Create a new Layer Template',
        body: Type.Object({
            name: Default.NameField,
            description: Default.DescriptionField,
            id: Type.Integer({
                description: 'Layer ID to create template from'
            }),
            connection: Type.Optional(Type.Integer())
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            const baseLayer = await config.models.Layer.augmented_from(req.body.id);

            if (user.access !== AuthUserAccess.ADMIN && baseLayer.template === false) {
                throw new Err(400, null, 'Layer is not a Template Layer');
            } else if (user.access != AuthUserAccess.ADMIN && !req.body.connection) {
                throw new Err(400, null, 'Must provide a Connection ID');
            }

            const layer = await layerControl.generate({
                template: true,
                username: user.email,
                connection: req.body.connection || null,
                name: req.body.name,
                description: req.body.description,
                enabled: true,
                logging: baseLayer.logging,
                task: baseLayer.task,
                memory: baseLayer.memory,
                timeout: baseLayer.timeout,
                priority: baseLayer.priority,
                alarm_period: baseLayer.alarm_period,
                alarm_evals: baseLayer.alarm_evals,
                alarm_points: baseLayer.alarm_points,
            }, {
                incoming: baseLayer.incoming ? {
                    config: baseLayer.incoming.config,
                    cron: baseLayer.incoming.cron,
                    webhooks: baseLayer.incoming.webhooks,
                    enabled_styles: baseLayer.incoming.enabled_styles,
                    styles: baseLayer.incoming.styles,
                    environment: {},
                    ephemeral: {}
                } : undefined,
                outgoing: baseLayer.outgoing ? {
                    environment: {},
                    ephemeral: {}
                } : undefined
            });

            res.json(layer)
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
