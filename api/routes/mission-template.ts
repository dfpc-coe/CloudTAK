import Err from '@openaddresses/batch-error';
import Config from '../lib/config.js';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Sprites from '../lib/sprites.js';
import { Type } from '@sinclair/typebox';
import { MissionTemplate, MissionTemplateLog, Palette } from '../lib/schema.js';
import { MissionTemplateResponse, MissionTemplateLogResponse, PaletteResponse, PaletteFeatureResponse, StandardResponse } from '../lib/types.js';
import { MissionTemplateSingleResponse } from '../lib/models/MissionTemplate.js';
import { PaletteFeatureStyle } from '../lib/palette.js';
import { BasicGeometryType } from '../lib/enums.js';
import * as Default from '../lib/limits.js';
import { Ajv } from 'ajv';

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
                enum: Object.keys(MissionTemplate),
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionTemplateResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.MissionTemplate.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                `,
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
            mission: Type.String(),
        }),
        res: MissionTemplateSingleResponse,
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
                description: 'A human friendly name for the Template',
            }),
            icon: Type.String({
                description: 'Base64 encoded icon image for the Template',
            }),
            description: Type.String({
                description: 'A human friendly description for the Template',
            }),
            keywords: Type.Array(Type.String(), {
                description: 'Keywords associated with this template',
                default: [],
            }),
        }),
        res: MissionTemplateResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            await Sprites.validate({
                data: req.body.icon,
            });

            const template = await config.models.MissionTemplate.generate({
                ...req.body,
                keywords: req.body.keywords.join(','),
            });

            res.json(await config.models.MissionTemplate.augmented_from(template.id));
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
            keywords: Type.Optional(Type.Array(Type.String())),
        }),
        res: MissionTemplateResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            if (req.body.icon) {
                await Sprites.validate({
                    data: req.body.icon,
                });
            }

            await config.models.MissionTemplate.commit(req.params.mission, {
                ...req.body,
                keywords: req.body.keywords ? req.body.keywords.join(',') : undefined,
            });

            res.json(await config.models.MissionTemplate.augmented_from(req.params.mission));
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
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
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
            mission: Type.String(),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(MissionTemplateLog),
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(MissionTemplateLogResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.MissionTemplateLog.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND template = ${req.params.mission}::UUID
                `,
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
            log: Type.String(),
        }),
        res: MissionTemplateLogResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const log = await config.models.MissionTemplateLog.augmented_from(req.params.log);

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
            mission: Type.String(),
        }),
        body: Type.Object({
            name: Type.String({
                description: 'A human friendly name for the Log',
            }),
            icon: Type.Optional(Type.String({
                description: 'Base64 encoded icon image for the Log',
            })),
            keywords: Type.Array(Type.String(), {
                description: 'Keywords associated with this log',
                default: [],
            }),
            description: Type.String({
                description: 'A human friendly description for the Log',
            }),
            schema: Type.Any({
                description: 'JSON Schema for the Log',
            }),
        }),
        res: MissionTemplateLogResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
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
                keywords: req.body.keywords.join(','),
                template: req.params.mission,
            });

            res.json(await config.models.MissionTemplateLog.augmented_from(log.id));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/template/mission/:mission/log/:log', {
        name: 'Update Log',
        group: 'MissionTemplate',
        params: Type.Object({
            mission: Type.String(),
            log: Type.String(),
        }),
        description: 'Update properties of a Log',
        body: Type.Object({
            name: Type.Optional(Type.String()),
            icon: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            description: Type.Optional(Type.String()),
            keywords: Type.Optional(Type.Array(Type.String())),
            schema: Type.Optional(Type.Any()),
        }),
        res: MissionTemplateLogResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
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

            const log = await config.models.MissionTemplateLog.commit(req.params.log, {
                ...req.body,
                keywords: req.body.keywords ? req.body.keywords.join(',') : undefined,
            });

            res.json(await config.models.MissionTemplateLog.augmented_from(log.id));
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
            log: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            await config.models.MissionTemplateLog.delete(req.params.log);

            res.json({ status: 200, message: 'Mission Template Log Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/template/mission/:mission/palette', {
        name: 'List Palettes',
        group: 'MissionTemplate',
        description: 'List Mission Template Palettes',
        params: Type.Object({
            mission: Type.String(),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Palette),
            }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(PaletteResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const list = await config.models.Palette.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND template = ${req.params.mission}::UUID
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/template/mission/:mission/palette/:palette', {
        name: 'Get Palette',
        group: 'MissionTemplate',
        description: 'Get Mission Template Palette',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
        }),
        res: PaletteResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            res.json(palette);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/template/mission/:mission/palette', {
        name: 'Create Palette',
        group: 'MissionTemplate',
        description: 'Create a new Mission Template Palette',
        params: Type.Object({
            mission: Type.String(),
        }),
        body: Type.Object({
            name: Type.String(),
        }),
        res: PaletteResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            const palette = await config.models.Palette.generate({
                ...req.body,
                template: req.params.mission,
            });

            res.json(await config.models.Palette.augmented_from(palette.uuid));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/template/mission/:mission/palette/:palette', {
        name: 'Update Palette',
        group: 'MissionTemplate',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
        }),
        description: 'Update properties of a Mission Template Palette',
        body: Type.Object({
            name: Type.Optional(Type.String()),
        }),
        res: PaletteResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            await config.models.Palette.commit(req.params.palette, {
                ...req.body,
            });

            res.json(await config.models.Palette.augmented_from(req.params.palette));
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/template/mission/:mission/palette/:palette', {
        name: 'Delete Palette',
        group: 'MissionTemplate',
        description: 'Delete a Mission Template Palette',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            await config.models.Palette.delete(req.params.palette);

            res.json({ status: 200, message: 'Palette Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/template/mission/:mission/palette/:palette/feature', {
        name: 'List Palette Features',
        group: 'MissionTemplate',
        description: 'List Mission Template Palette Features',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({ default: 'created', enum: Object.keys(Palette) }),
            filter: Default.Filter,
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(PaletteFeatureResponse),
        }),
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            const list = await config.models.PaletteFeature.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND palette = ${req.params.palette}::UUID
                `,
            });

            res.json(list);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/template/mission/:mission/palette/:palette/feature/:feature', {
        name: 'Get Palette Feature',
        group: 'MissionTemplate',
        description: 'Get Mission Template Palette Feature',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
            feature: Type.String(),
        }),
        res: PaletteFeatureResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req);

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            const feature = await config.models.PaletteFeature.from(req.params.feature);

            if (feature.palette !== req.params.palette) {
                throw new Err(400, null, 'Palette feature does not belong to Palette specified');
            }

            res.json(feature);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/template/mission/:mission/palette/:palette/feature', {
        name: 'Create Palette Feature',
        group: 'MissionTemplate',
        description: 'Create a new Mission Template Palette Feature',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
        }),
        body: Type.Object({
            type: Type.Enum(BasicGeometryType),
            name: Type.String(),
            style: PaletteFeatureStyle,
        }),
        res: PaletteFeatureResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            const feature = await config.models.PaletteFeature.generate({
                palette: req.params.palette,
                ...req.body,
            });

            res.json(feature);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/template/mission/:mission/palette/:palette/feature/:feature', {
        name: 'Update Palette Feature',
        group: 'MissionTemplate',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
            feature: Type.String(),
        }),
        description: 'Update properties of a Mission Template Palette Feature',
        body: Type.Object({
            type: Type.Optional(Type.Enum(BasicGeometryType)),
            name: Type.Optional(Type.String()),
            style: Type.Optional(PaletteFeatureStyle),
        }),
        res: PaletteFeatureResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            let feature = await config.models.PaletteFeature.from(req.params.feature);

            if (feature.palette !== req.params.palette) {
                throw new Err(400, null, 'Palette feature does not belong to Palette specified');
            }

            feature = await config.models.PaletteFeature.commit(req.params.feature, {
                ...req.body,
            });

            res.json(feature);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/template/mission/:mission/palette/:palette/feature/:feature', {
        name: 'Delete Palette Feature',
        group: 'MissionTemplate',
        description: 'Delete a Mission Template Palette Feature',
        params: Type.Object({
            mission: Type.String(),
            palette: Type.String(),
            feature: Type.String(),
        }),
        res: StandardResponse,
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, {
                admin: true,
            });

            const palette = await config.models.Palette.augmented_from(req.params.palette);

            if (palette.template !== req.params.mission) {
                throw new Err(400, null, 'Palette does not belong to Mission Template specified');
            }

            const feature = await config.models.PaletteFeature.from(req.params.feature);

            if (feature.palette !== req.params.palette) {
                throw new Err(400, null, 'Palette feature does not belong to Palette specified');
            }

            await config.models.PaletteFeature.delete(req.params.feature);

            res.json({ status: 200, message: 'Palette Feature Deleted' });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
