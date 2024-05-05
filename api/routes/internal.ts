import { Type } from '@sinclair/typebox'
import { GenericListOrder } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { Param } from '@openaddresses/batch-generic';
import Alarm from '../lib/aws/alarm.js';
import Cacher from '../lib/cacher.js';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import Config from '../lib/config.js';
import DataMission from '../lib/data-mission.js';
import { DataResponse, LayerResponse } from '../lib/types.js';
import { Layer } from '../lib/schema.js'

export default async function router(schema: Schema, config: Config) {
    const alarm = new Alarm(config.StackName);

    await schema.get('/layer', {
        name: 'List Layers',
        group: 'Internal',
        description: 'Allow admins to list all layers on the server',
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Layer)})),
            filter: Type.Optional(Type.String({default: ''})),
            data: Type.Optional(Type.Integer()),
            connection: Type.Optional(Type.Integer()),
        }),
        res: Type.Object({
            total: Type.Integer(),
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

            const list = await config.models.Layer.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${req.query.filter}
                    AND (${Param(req.query.connection)}::BIGINT IS NULL OR ${Param(req.query.connection)}::BIGINT = layers.connection)
                    AND (${Param(req.query.data)}::BIGINT IS NULL OR ${Param(req.query.data)}::BIGINT = layers.data)
                `
            });

            const alarms = config.StackName !== 'test' ? await alarm.list() : new Map();

            const status = { healthy: 0, alarm: 0, unknown: 0 };
            for (const state of alarms.values()) {
                if (state === 'healthy') status.healthy++;
                if (state === 'alarm') status.alarm++;
                if (state === 'unknown') status.unknown++;
            }

            res.json({
                status,
                total: list.total,
                items: list.items.map((layer) => {
                    return { status: alarms.get(layer.id) || 'unknown', ...layer }
                })
            });
        } catch (err) {
            return Err.respond(err, res);
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
            dataid: Type.Integer()
        }),
        res: DataResponse
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [
                    { access: AuthResourceAccess.DATA, id: req.params.dataid }
                ]
            });

            const data = await config.models.Data.from(req.params.dataid);

            try {
                await DataMission.sync(config, data);
            } catch (err) {
                return res.json({
                    mission_exists: false,
                    mission_error: err instanceof Error ? err.message : String(err),
                    ...data
                });
            }

            return res.json({
                mission_exists: true,
                ...data
            });
        } catch (err) {
            return Err.respond(err, res);
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
        params: Type.Object({
            layerid: Type.Integer(),
        }),
        res: LayerResponse
    }, async (req, res) => {
        try {
            await Auth.as_resource(config, req, {
                resources: [
                    { access: AuthResourceAccess.LAYER, id: req.params.layerid }
                ]
            });

            const layer = await config.cacher.get(Cacher.Miss(req.query, `layer-${req.params.layerid}`), async () => {
                return await config.models.Layer.from(req.params.layerid);
            });

            return res.json({
                status: config.StackName !== 'test' ? await alarm.get(layer.id) : 'unknown',
                ...layer
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
