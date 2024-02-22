import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import CW from '../lib/aws/metric.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { Param } from '@openaddresses/batch-generic';
import { sql } from 'drizzle-orm';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';
import { Type } from '@sinclair/typebox'
import { GenericListOrder } from '@openaddresses/batch-generic';
import { StandardResponse, ConnectionSinkResponse } from '../lib/types.js';
import Schema from '@openaddresses/batch-schema';

export default async function router(schema: Schema, config: Config) {
    const cw = new CW(config.StackName);

    await schema.get('/connection/:connectionid/sink', {
        name: 'List Sinks',
        group: 'ConnectionSink',
        description: 'List Sinks',
        params: Type.Object({
            connectionid: Type.Integer(),
        }),
        query: Type.Object({
            limit: Type.Optional(Type.Integer()),
            page: Type.Optional(Type.Integer()),
            order: Type.Optional(Type.Enum(GenericListOrder)),
            sort: Type.Optional(Type.String({default: 'created'})),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            status: Type.Object({
                dead: Type.Integer({ description: 'The connection is not currently connected to a TAK server' }),
                live: Type.Integer({ description: 'The connection is currently connected to a TAK server'}),
                unknown: Type.Integer({ description: 'The status of the connection could not be determined'}),
            }),
            items: Type.Array(ConnectionSinkResponse)
        })
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const list = await config.models.ConnectionSink.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    name ~* ${Param(req.query.filter)}
                    AND connection = ${Param(req.query.connection)}
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
            connectionid: Type.Integer(),
        }),
        body: Type.Object({
            name: Type.String(),
            type: Type.String(),
            logging: Type.Boolean(),
            enabled: Type.Boolean(),
            body: Type.Object({
                layer: Type.String(),
                url: Type.String()
            });
        }),
        res: ConnectionSinkResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const conn = await config.models.Connection.from(req.params.connectionid);

            const sink = await config.models.ConnectionSink.generate({
                ...req.body,
                connection: conn.id,
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
            connectionid: Type.Integer(),
            sinkid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            type: Type.Optional(Type.String()),
            logging: Type.Optional(Type.Boolean()),
        }),
        res: ConnectionSinkResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const conn = await config.models.Connection.from(req.params.connectionid);
            let sink = await config.models.ConnectionSink.from(req.params.sinkid);

            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

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
            connectionid: Type.Integer(),
            sinkid: Type.Integer()
        }),
        res: ConnectionSinkResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });


            const conn = await config.models.Connection.from(req.params.connectionid);
            const sink = await config.models.ConnectionSink.from(req.params.sinkid);
            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

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
            connectionid: Type.Integer(),
            sinkid: Type.Integer()
        }),
        res: {
            type: 'object',
            required: ['stats'],
            additionalProperties: false,
            properties: {
                stats: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['label', 'success', 'failure'],
                        properties: {
                            label: { type: 'string' },
                            success: { type: 'integer' },
                            failure: { type: 'integer' }
                        }
                    }
                }
            }
        }
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const conn = await config.models.Connection.from(req.params.connectionid);
            const sink = await config.models.ConnectionSink.from(req.params.sinkid);
            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

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

            let ts_arr = Array.from(timestamps).sort((d1, d2) => {
                return d1.getTime() - d2.getTime();
            }).map((d) => {
                return String(d);
            });

            const statsres: any = { stats: [] }

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
            connectionid: Type.Integer(),
            sinkid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            });

            const conn = await config.models.Connection.from(req.params.connectionid);
            const sink = await config.models.ConnectionSink.from(req.params.sinkid);
            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

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
