import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import CW from '../lib/aws/metric.js';
import { AuthResourceAccess } from '@tak-ps/blueprint-login';
import { X509Certificate } from 'crypto';

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
            await Auth.is_auth(config.models, req);

            const list = await config.models.Connection.list({
                limit: Number(req.query.limit),
                page: Number(req.query.page),
                order: String(req.query.order),
                sort: String(req.query.sort),
                where: sql`
                    name ~* ${req.query.filter}
                `
            });

            const json = {
                total: list.total,
                status: { dead: 0, live: 0, unknown: 0 },
                items: list.items.map((conn) => {
                    return {
                        status: config.conns.status(conn.id),
                        ...conn
                    }
                })
            }

            for (const conn of config.conns.values()) {
                if (!conn.tak) json.status.unknown++;
                else json.status.live++;
            }

            return res.json(json);
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
            await Auth.is_auth(config.models, req);

            if (!config.server) throw new Err(400, null, 'TAK Server must be configured before a connection can be made');
            const conn = await config.models.Connection.generate(req.body);

            if (conn.enabled) await config.conns.add(conn);

            return res.json({
                status: config.conns.status(conn.id),
                ...conn
            });
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
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const conn = await config.models.Connection.commit(parseInt(req.params.connectionid), {
                updated: sql`Now()`,
                ...req.body
            });

            if (conn.enabled && !config.conns.has(conn.id)) {
                await config.conns.add(conn);
            } else if (!conn.enabled && config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(conn);
            }

            const { validFrom, validTo } = new X509Certificate(conn.auth.cert);

            return res.json({
                status: config.conns.status(conn.id),
                certificate: { validFrom, validTo },
                ...conn
            });
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
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const conn = await config.models.Connection.from(parseInt(req.params.connectionid));
            const { validFrom, validTo } = new X509Certificate(conn.auth.cert);

            return res.json({
                status: config.conns.status(conn.id),
                certificate: { validFrom, validTo },
                ...conn
            });
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
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const conn = await config.models.Connection.from(parseInt(req.params.connectionid));

            if (!conn.enabled) throw new Err(400, null, 'Connection is not currently enabled');

            if (config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(conn);
            } else {
                await config.conns.add(conn);
            }

            const { validFrom, validTo } = new X509Certificate(conn.auth.cert);

            return res.json({
                status: config.conns.status(conn.id),
                certificate: { validFrom, validTo },
                ...conn
            });
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
            await Auth.is_auth(config.models, req);

            await config.models.Connection.delete(parseInt(req.params.connectionid));

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
            await Auth.is_auth(config.models, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: parseInt(req.params.connectionid) }]
            });

            const conn = await config.models.Connection.from(parseInt(req.params.connectionid));

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
