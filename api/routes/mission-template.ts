import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Sprites from '../lib/sprites.js';
import { Type } from '@sinclair/typebox'
import { MissionTemplate, MissionTemplateLog } from '../lib/schema.js';
import { MissionTemplateResponse, MissionTemplateLogResponse, StandardResponse } from '../lib/types.js';
import { MissionTemplateSingleResponse } from '../lib/models/MissionTemplate.js';
import * as Default from '../lib/limits.js';
import Ajv from 'ajv';

const ajv = new Ajv();

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
        res: MissionTemplateSingleResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const template = await config.models.MissionTemplate.augmented_from(req.params.mission);

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

    await schema.get('/template/mission/:mission/log', {
        name: 'List Logs',
        group: 'MissionTemplate',
        description: 'List Mission Template Logs',
        params: Type.Object({
            mission: Type.String()
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(MissionTemplateLog)
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionTemplateLogResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.MissionTemplateLog.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND template = ${req.params.mission}::UUID
                `
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/template/mission/:mission/log/:log', {
        name: 'Get Log',
        group: 'MissionTemplate',
        description: 'Get Mission Template Log',
        params: Type.Object({
            mission: Type.String(),
            log: Type.String()
        }),
        res: MissionTemplateLogResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const log = await config.models.MissionTemplateLog.from(req.params.log);

            res.json(log);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/template/mission/:mission/log', {
        name: 'Create Log',
        group: 'MissionTemplate',
        description: 'Create a new Mission Template Log',
        params: Type.Object({
            mission: Type.String()
        }),
        body: Type.Object({
            name: Type.String({
                description: 'A human friendly name for the Log'
            }),
            icon: Type.Optional(Type.String({
                description: 'Base64 encoded icon image for the Log'
            })),
            description: Type.String({
                description: 'A human friendly description for the Log'
            }),
            schema: Type.Any({
                description: 'JSON Schema for the Log'
            })
        }),
        res: MissionTemplateLogResponse
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

            try {
                ajv.compile(req.body.schema);
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid Schema');
            }

            const log = await config.models.MissionTemplateLog.generate({
                ...req.body,
                template: req.params.mission
            });

            res.json(log);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/template/mission/:mission/log/:log', {
        name: 'Update Log',
        group: 'MissionTemplate',
        params: Type.Object({
            mission: Type.String(),
            log: Type.String()
        }),
        description: 'Update properties of a Log',
        body: Type.Object({
            name: Type.Optional(Type.String()),
            icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            description: Type.Optional(Type.String()),
            schema: Type.Optional(Type.Any())
        }),
        res: MissionTemplateLogResponse
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

            if (req.body.schema) {
                try {
                    ajv.compile(req.body.schema);
                } catch (err) {
                    throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Invalid Schema');
                }
            }

            const log = await config.models.MissionTemplateLog.commit(req.params.log, req.body);

            res.json(log);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.delete('/template/mission/:mission/log/:log', {
        name: 'Delete Log',
        group: 'MissionTemplate',
        description: 'Delete a Mission Template Log',
        params: Type.Object({
            mission: Type.String(),
            log: Type.String()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
             await Auth.as_user(config, req, {
                admin: true
            });

            await config.models.MissionTemplateLog.delete(req.params.log);

            res.json({ status: 200, message: 'Mission Template Log Deleted' });
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
