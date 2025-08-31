import { Type } from '@sinclair/typebox'
import { sql } from 'drizzle-orm';
import { Param } from '@openaddresses/batch-generic';
import Alarm from '../lib/aws/alarm.js';
import Cacher from '../lib/cacher.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess, AuthUser, AuthUserAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import DataMission from '../lib/data-mission.js';
import { DataResponse, LayerResponse } from '../lib/types.js';
import { Layer } from '../lib/schema.js'
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const alarm = new Alarm(config.StackName);

    await schema.get('/layer', {
        name: 'List Layers',
        group: 'Internal',
        description: 'Allow admins to list all layers on the server',
        query: Type.Object({
            limit: Default.Limit,
            alarms: Type.Boolean({
                default: false,
                description: 'Get Live Alarm state from CloudWatch'
            }),
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Layer)
            }),
            filter: Default.Filter,
            task: Type.Optional(Type.String()),
            data: Type.Optional(Type.Integer({ minimum: 1 })),
            template: Type.Optional(Type.Boolean()),
            connection: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        res: Type.Object({
            total: Type.Integer(),
            tasks: Type.Array(Type.String()),
            status: Type.Object({
                healthy: Type.Integer(),
                alarm: Type.Integer(),
                unknown: Type.Integer(),
            }),
            items: Type.Array(LayerResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            const list = await config.models.Layer.augmented_list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    layers.name ~* ${req.query.filter}
                    AND (${Param(req.query.connection)}::BIGINT IS NULL OR ${Param(req.query.connection)}::BIGINT = layers.connection)
                    AND (${Param(req.query.template)}::BOOLEAN IS NULL OR ${Param(req.query.template)}::BOOLEAN = layers.template)
                    AND (${Param(req.query.data)}::BIGINT IS NULL OR ${Param(req.query.data)}::BIGINT = layers_incoming.data)
                    AND (${Param(req.query.task)}::TEXT IS NULL OR Starts_With(layers.task, ${Param(req.query.task)}::TEXT))
                `
            });

            let alarms = new Map();
            const status = { healthy: 0, alarm: 0, unknown: 0 };
            try {
                alarms = (config.StackName !== 'test' && req.query.alarms) ? await alarm.list() : new Map();

                for (const state of alarms.values()) {
                    if (state === 'healthy') status.healthy++;
                    if (state === 'alarm') status.alarm++;
                    if (state === 'unknown') status.unknown++;
                }
            } catch (err) {
                // Surface this in the future - failing alarm lists shouldn't nuke access
                console.error(err);
            }

            res.json({
                status,
                total: list.total,
                tasks: await config.models.Layer.tasks(),
                items: list.items.map((layer) => {
                    return {
                        status: alarms.get(layer.id) || 'unknown',
                        ...layer,
                    }
                })
            });
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/data/:dataid', {
        private: true,
        name: 'Get Data',
        group: 'Internal',
        description: `
            Events don't have the Connection ID but they have a valid data token
            This API allows a data token to request the data object and obtain the
            connection ID for subsequent calls
        `,
        params: Type.Object({
            dataid: Type.Integer({ minimum: 1 })
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            const auth = await Auth.as_resource(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid }
                ]
            });

            if (auth instanceof AuthUser) {
                const a = auth as AuthUser;
                if (a.access !== AuthUserAccess.ADMIN) {
                    throw new Err(401, null, 'User must be a System Administrator to access this resource');
                }
            }

            const data = await config.models.Data.from(req.params.dataid);

            try {
                await DataMission.sync(config, data);

                res.json({
                    mission_exists: true,
                    ...data
                });
            } catch (err) {
                res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/layer/:layerid', {
        name: 'Get Layer',
        group: 'Internal',
        description: `
            Events don't have the Connection ID but they have a valid data token
            This API allows a layer token to request the layer object and obtain the
            connection ID for subsequent calls
        `,
        query: Type.Object({
            alarms: Type.Boolean({
                default: false,
                description: 'Get Live Alarm state from CloudWatch'
            }),
        }),
        params: Type.Object({
            layerid: Type.Integer({ minimum: 1 }),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.augmented_from(req.params.layerid);
            });

            let status = 'unknown';
            if (config.StackName !== 'test' && req.query.alarms) {
                try {
                    status = await alarm.get(layer.id);
                } catch (err) {
                    console.error(err);
                }
            }

            res.json({
                status,
                ...layer
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
