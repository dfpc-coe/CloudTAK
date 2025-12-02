import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Sprites from '../lib/sprites.js';
import { Type } from '@sinclair/typebox'
import { MissionTemplate } from '../lib/schema.js';
import { MissionTemplateResponse, StandardResponse } from '../lib/types.js';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/template/mission', {
        name: 'List Templates',
        group: 'MissionTemplate',
        description: 'List Mission Templates',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(MissionTemplate)
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionTemplateResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.MissionTemplate.list({
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

    await schema.get('/template/mission/:mission', {
        name: 'Get Template',
        group: 'MissionTemplate',
        description: 'Get Mission Template',
        params: Type.Object({
            mission: Type.String()
        }),
        res: MissionTemplateResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const template = await config.models.MissionTemplate.from(req.params.mission);

            res.json(template);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/template/mission', {
        name: 'Create Template',
        group: 'MissionTemplate',
        description: 'Create a new Mission Template',
        body: Type.Object({
            name: Type.String({
                description: 'A human friendly name for the Template'
            }),
            icon: Type.String({
                description: 'Base64 encoded icon image for the Template'
            }),
            description: Type.String({
                description: 'A human friendly description for the Template'
            }),
        }),
        res: MissionTemplateResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            await Sprites.validate({
                data: req.body.icon,
            });

            const template = await config.models.MissionTemplate.generate(req.body);

            res.json(template);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/template/mission/:mission', {
        name: 'Update Template',
        group: 'MissionTemplate',
        params: Type.Object({
            mission: Type.String(),
        }),
        description: 'Update properties of a Template',
        body: Type.Object({
            name: Type.Optional(Type.String()),
            icon: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
        }),
        res: MissionTemplateResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true
            });

            if (req.body.icon) {
                await Sprites.validate({
                    data: req.body.icon,
                });
            }

            const template = await config.models.MissionTemplate.commit(req.params.mission, req.body);

            res.json(template);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/template/mission/:mission', {
        name: 'Delete Template',
        group: 'MissionTemplate',
        description: 'Delete a Mission Template',
        params: Type.Object({
            mission: Type.String(),
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
             await Auth.as_user(config, req, {
                admin: true
            });

            await config.models.MissionTemplate.delete(req.params.mission);

            res.json({ status: 200, message: 'Mission Template Deleted' });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
