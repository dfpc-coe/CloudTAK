import Err from '@openaddresses/batch-error';
import { Connection } from '../lib/schema.ts';
import Auth from '../lib/auth.ts';
import { sql } from 'slonik';
import Config from '../lib/config.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import CW from '../lib/aws/metric.ts';

export default async function router(schema: any, config: Config) {
    const cw = new CW(config.StackName);

    await schema.get('/connection', {
        name: 'List Connections',
        group: 'Connection',
        auth: 'user',
        description: 'List Connections',
        query: 'req.query.ListConnections.json',
        res: 'res.ListConnections.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await Connection.list(config.pool, req.query);

            list.connections.map((conn: any) => {
                conn.status = config.conns.status(conn.id);
            });

            list.status = { dead: 0, live: 0, unknown: 0 };
            for (const conn of config.conns.values()) {
                if (!conn.tak) list.status.unknown++;
                else list.status[conn.tak.open]++;
            }

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection', {
        name: 'Create Connection',
        group: 'Connection',
        auth: 'admin',
        description: 'Register a new connection',
        body: 'req.body.CreateConnection.json',
        res: 'res.Connection.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!config.server) throw new Err(400, null, 'TAK Server must be configured before a connection can be made');
            const conn = await Connection.generate(config.pool, req.body);

            if (conn.enabled) await config.conns.add(conn);

            conn.status = config.conns.status(conn.id);
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid', {
        name: 'Update Connection',
        group: 'Connection',
        auth: 'admin',
        description: 'Update a connection',
        ':connectionid': 'integer',
        body: 'req.body.PatchConnection.json',
        res: 'res.Connection.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);
            const conn = await Connection.commit(config.pool, req.params.connectionid, {
                updated: sql`Now()`,
                ...req.body
            });

            if (conn.enabled && !config.conns.has(conn.id)) {
                await config.conns.add(conn);
            } else if (!conn.enabled && config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(conn);
            }

            conn.status = config.conns.status(conn.id);
            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid', {
        name: 'Get Connection',
        group: 'Connection',
        auth: 'user',
        description: 'Get a connection',
        ':connectionid': 'integer',
        res: 'res.Connection.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = (await Connection.from(config.pool, req.params.connectionid)).serialize();
            conn.status = config.conns.status(conn.id);

            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/refresh', {
        name: 'Refresh Connection',
        group: 'Connection',
        auth: 'admin',
        description: 'Refresh a connection',
        ':connectionid': 'integer',
        res: 'res.Connection.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            if (!conn.enabled) throw new Err(400, null, 'Connection is not currently enabled');

            if (config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(conn);
            } else {
                await config.conns.add(conn);
            }

            const json = conn.serialize()
            json.status = config.conns.status(conn.id);

            return res.json(json);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid', {
        name: 'Delete Connection',
        group: 'Connection',
        auth: 'user',
        description: 'Delete a connection',
        ':connectionid': 'integer',
        res: 'res.Standard.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            await Connection.delete(config.pool, req.params.connectionid);

            config.conns.delete(parseInt(req.params.connectionid));

            return res.json({
                status: 200,
                message: 'Connection Deleted'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/stats', {
        name: 'Get Stats',
        group: 'Connection',
        auth: 'admin',
        description: 'Return Conn Success/Failure Stats',
        ':connectionid': 'integer',
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
                        }
                    }
                }
            }
        }
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const conn = await Connection.from(config.pool, req.params.connectionid);

            const stats = await cw.connection(conn.id);

            const timestamps: Set<Date> = new Set();
            const map: Map<string, number> = new Map();
            const stat = stats.MetricDataResults[0];

            for (let i = 0; i < stat.Timestamps.length; i++) {
                timestamps.add(stat.Timestamps[i]);
                map.set(String(stat.Timestamps[i]), Number(stat.Values[i]));
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
                    success: map.get(ts) || 0,
                });
            }

            return res.json(statsres);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
