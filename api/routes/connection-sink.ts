import Err from '@openaddresses/batch-error';
import Connection from '../lib/types/connection.js';
import ConnectionSink from '../lib/types/connection-sink.js';
import Auth from '../lib/auth.ts';
import CW from '../lib/aws/metric.ts';
import Config from '../lib/config.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    const cw = new CW(config.StackName);

    await schema.get('/connection/:connectionid/sink', {
        name: 'List Sinks',
        group: 'ConnectionSink',
        auth: 'user',
        description: 'List Sinks',
        ':connectionid': 'integer',
        query: 'req.query.ListConnectionSinks.json',
        res: 'res.ListConnectionSinks.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await ConnectionSink.list(config.pool, {
                ...req.query,
                connection: req.params.connectionid
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/sink', {
        name: 'Create Sink',
        group: 'ConnectionSink',
        auth: 'admin',
        description: 'Register a new connection sink',
        ':connectionid': 'integer',
        body: 'req.body.CreateConnectionSink.json',
        res: 'res.ConnectionSink.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const sink = await ConnectionSink.generate(config.pool, {
                connection: conn.id,
                ...req.body
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
        auth: 'admin',
        description: 'Update a connection sink',
        ':connectionid': 'integer',
        ':sinkid': 'integer',
        body: 'req.body.PatchConnectionSink.json',
        res: 'res.ConnectionSink.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const sink = await ConnectionSink.from(config.pool, req.params.sinkid);

            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

            await sink.commit(req.body);

            await config.cacher.del(`connection-${req.params.connectionid}-sinks`);

            return res.json(sink);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/sink/:sinkid', {
        name: 'Get Sink',
        group: 'ConnectionSink',
        auth: 'admin',
        description: 'Get a connection sink',
        ':connectionid': 'integer',
        ':sinkid': 'integer',
        res: 'res.ConnectionSink.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const sink = await ConnectionSink.from(config.pool, req.params.sinkid);

            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

            return res.json(sink);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/sink/:sinkid/stats', {
        name: 'Get Stats',
        group: 'ConnectionSink',
        auth: 'admin',
        description: 'Return Sink Success/Failure Stats',
        ':connectionid': 'integer',
        ':sinkid': 'integer',
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
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);
            const sink = await ConnectionSink.from(config.pool, req.params.sinkid);
            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

            const stats = await cw.sink(sink.id);

            const timestamps: Set<Date> = new Set();
            const successMap: Map<string, number> = new Map();
            const failureMap: Map<string, number> = new Map();
            for (const stat of stats.MetricDataResults) {
                let map;
                if (stat.Label === 'ConnectionSinkSuccess') map = successMap;
                else if (stat.Label === 'ConnectionSinkFailure') map = failureMap;

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
        auth: 'admin',
        description: 'Delete a connection sink',
        ':connectionid': 'integer',
        ':sinkid': 'integer',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const sink = await ConnectionSink.from(config.pool, req.params.sinkid);

            if (sink.connection !== conn.id) throw new Err(400, null, 'Sink must belong to parent connection');

            await sink.delete();

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
