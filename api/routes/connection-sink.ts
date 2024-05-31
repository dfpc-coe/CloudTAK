import Err from '@openaddresses/batch-error';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import CW from '../lib/aws/metric.js';
import Config from '../lib/config.js';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { Type } from '@sinclair/typebox'
import { StandardResponse, ConnectionSinkResponse } from '../lib/types.js';
import { ConnectionSink } from '../lib/schema.js';
import Schema from '@openaddresses/batch-schema';
import * as Default from '../lib/limits.js';

export default async function router(schema: Schema, config: Config) {
    const cw = new CW(config.StackName);

    await schema.get('/connection/:connectionid/sink', {
        name: 'List Sinks',
        group: 'ConnectionSink',
        description: 'List Sinks',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(ConnectionSink)})),
            filter: Default.Filter,
            enabled: Type.Optional(Type.Boolean())
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(ConnectionSinkResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const list = await config.models.ConnectionSink.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where: sql`
                    name ~* ${Param(req.query.filter)}
                    AND connection = ${Param(req.params.connectionid)}
                    AND (${Param(req.query.enabled)}::BOOLEAN IS NULL OR enabled = ${Param(req.query.enabled)}::BOOLEAN)
                `
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/sink', {
        name: 'Create Sink',
        group: 'ConnectionSink',
        description: 'Register a new connection sink',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        body: Type.Object({
            name: Default.NameField,
            type: Type.String(),
            logging: Type.Boolean(),
            enabled: Type.Boolean(),
            body: Type.Object({
                layer: Type.String(),
                url: Type.String(),
                username: Type.Optional(Type.String()),
                password: Type.Optional(Type.String())
            })
        }),
        res: ConnectionSinkResponse
    }, async (req, res) => {
        try {
            const { connection } =  await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const sink = await config.models.ConnectionSink.generate({
                ...req.body,
                connection: connection.id,
            });

            await config.cacher.del(`connection-${req.params.connectionid}-sinks`);

            return res.json(sink);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid/sink/:sinkid', {
        name: 'Update Sink',
        group: 'ConnectionSink',
        description: 'Update a connection sink',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            sinkid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            type: Type.Optional(Type.String()),
            logging: Type.Optional(Type.Boolean()),
        }),
        res: ConnectionSinkResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            let sink = await config.models.ConnectionSink.from(req.params.sinkid);

            if (sink.connection !== connection.id) throw new Err(400, null, 'Sink must belong to parent connection');

            sink = await config.models.ConnectionSink.commit(sink.id, req.body);

            await config.cacher.del(`connection-${req.params.connectionid}-sinks`);

            return res.json(sink);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/sink/:sinkid', {
        name: 'Get Sink',
        group: 'ConnectionSink',
        description: 'Get a connection sink',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            sinkid: Type.Integer({ minimum: 1 })
        }),
        res: ConnectionSinkResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const sink = await config.models.ConnectionSink.from(req.params.sinkid);
            if (sink.connection !== connection.id) throw new Err(400, null, 'Sink must belong to parent connection');

            return res.json(sink);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/sink/:sinkid/stats', {
        name: 'Get Stats',
        group: 'ConnectionSink',
        description: 'Return Sink Success/Failure Stats',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            sinkid: Type.Integer({ minimum: 1 })
        }),
        res: Type.Object({
            stats: Type.Array(Type.Object({
                label: Type.String(),
                success: Type.Integer(),
                failure: Type.Integer()
            }))
        })
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const sink = await config.models.ConnectionSink.from(req.params.sinkid);
            if (sink.connection !== connection.id) throw new Err(400, null, 'Sink must belong to parent connection');

            const stats = await cw.sink(sink.id);

            const timestamps: Set<Date> = new Set();
            const successMap: Map<string, number> = new Map();
            const failureMap: Map<string, number> = new Map();
            for (const stat of stats) {
                let map: Map<string, number> = new Map();
                if (stat.Label === 'ConnectionSinkSuccess') {
                    map = successMap;
                } else if (stat.Label === 'ConnectionSinkFailure') {
                    map = failureMap;
                }

                if (!stat.Timestamps) stat.Timestamps = [];
                if (!stat.Values) stat.Values = [];
                for (let i = 0; i < stat.Timestamps.length; i++) {
                    timestamps.add(stat.Timestamps[i]);
                    map.set(String(stat.Timestamps[i]), Number(stat.Values[i]));
                }
            }

            const ts_arr = Array.from(timestamps).sort((d1, d2) => {
                return d1.getTime() - d2.getTime();
            }).map((d) => {
                return String(d);
            });

            const statsres: {
                stats: Array<{
                    label: string;
                    success: number;
                    failure: number;
                }>
            } = { stats: [] }

            for (const ts of ts_arr) {
                statsres.stats.push({
                    label: ts,
                    success: successMap.get(ts) || 0,
                    failure: failureMap.get(ts) || 0
                });
            }

            return res.json(statsres);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid/sink/:sinkid', {
        name: 'Delete Sink',
        group: 'ConnectionSink',
        description: 'Delete a connection sink',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
            sinkid: Type.Integer({ minimum: 1 })
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const sink = await config.models.ConnectionSink.from(req.params.sinkid);
            if (sink.connection !== connection.id) throw new Err(400, null, 'Sink must belong to parent connection');

            await config.models.ConnectionSink.delete(sink.id);

            await config.cacher.del(`connection-${req.params.connectionid}-sinks`);

            return res.json({
                status: 200,
                message: 'Sink Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
