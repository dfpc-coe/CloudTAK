import Err from '@openaddresses/batch-error';
import { sql, and, inArray } from 'drizzle-orm';
import Config from '../lib/config.js';
import CW from '../lib/aws/metric.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import { X509Certificate } from 'crypto';
import { Type } from '@sinclair/typebox'
import { GenericListOrder } from '@openaddresses/batch-generic';
import { StandardResponse, ConnectionResponse } from '../lib/types.js';
import { Connection } from '../lib/schema.js';
import { MachineConnConfig } from '../lib/connection-config.js';
import Schema from '@openaddresses/batch-schema';

export default async function router(schema: Schema, config: Config) {
    const cw = new CW(config.StackName);

    await schema.get('/connection', {
        name: 'List Connections',
        group: 'Connection',
        description: 'List Connections',
        query: Type.Object({
            limit: Type.Integer({ default: 10 }),
            page: Type.Integer({ default: 0 }),
            order: Type.Enum(GenericListOrder, { default: GenericListOrder.ASC }),
            sort: Type.Optional(Type.String({default: 'created', enum: Object.keys(Connection)})),
            filter: Type.Optional(Type.String({default: ''}))
        }),
        res: Type.Object({
            total: Type.Integer(),
            status: Type.Object({
                dead: Type.Integer({ description: 'The connection is not currently connected to a TAK server' }),
                live: Type.Integer({ description: 'The connection is currently connected to a TAK server'}),
                unknown: Type.Integer({ description: 'The status of the connection could not be determined'}),
            }),
            items: Type.Array(ConnectionResponse)
        })
    }, async (req, res) => {
        try {
            const profile = await Auth.as_profile(config, req);

            let where;
            if (profile.system_admin) {
                where = sql`name ~* ${req.query.filter}`
            } else if (profile.agency_admin.length) {
                where = and(
                    sql`name ~* ${req.query.filter}`,
                    inArray(Connection.agency, profile.agency_admin)
                );
            } else {
                throw new Err(400, null, 'Insufficient Access')
            }

            const list = await config.models.Connection.list({
                limit: req.query.limit,
                page: req.query.page,
                order: req.query.order,
                sort: req.query.sort,
                where
            });

            const json = {
                total: list.total,
                status: { dead: 0, live: 0, unknown: 0 },
                items: list.items.map((conn) => {
                    const { validFrom, validTo } = new X509Certificate(conn.auth.cert);

                    return {
                        status: config.conns.status(conn.id),
                        certificate: { validFrom, validTo },
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
        description: 'Register a new connection',
        body: Type.Object({
            name: Type.String(),
            description: Type.String(),
            enabled: Type.Optional(Type.Boolean()),
            agency: Type.Optional(Type.Integer()),
            auth: Type.Object({
                key: Type.String(),
                cert: Type.String()
            })
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);

            if (!req.body.agency && user.access !== 'admin') {
                throw new Err(400, null, 'Only System Admins can create a server without an Agency Configured');
            } else if (req.body.agency && user.access !== 'admin') {
                const profile = await config.models.Profile.from(user.email);

                if (!profile.agency_admin || !profile.agency_admin.includes(req.body.agency)) {
                    throw new Err(400, null, 'Cannot create a connection for an Agency you are not an admin of');
                }
            }

            if (!config.server) throw new Err(400, null, 'TAK Server must be configured before a connection can be made');
            const conn = await config.models.Connection.generate(req.body);

            if (conn.enabled) await config.conns.add(new MachineConnConfig(config, conn));

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

    await schema.patch('/connection/:connectionid', {
        name: 'Update Connection',
        group: 'Connection',
        description: 'Update a connection',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        body: Type.Object({
            name: Type.Optional(Type.String()),
            description: Type.Optional(Type.String()),
            enabled: Type.Optional(Type.Boolean()),
            agency: Type.Optional(Type.Integer()),
            auth: Type.Optional(Type.Object({
                key: Type.String(),
                cert: Type.String()
            }))
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (req.body.agency && await Auth.is_user(config, req)) {
                const user = await Auth.as_user(config, req, { admin: true });
                if (!user) throw new Err(400, null, 'Only System Admins can change an agency once a connection is created');
            }

            const conn = await config.models.Connection.commit(req.params.connectionid, {
                updated: sql`Now()`,
                ...req.body
            });

            if (conn.enabled && !config.conns.has(conn.id)) {
                await config.conns.add(new MachineConnConfig(config, conn));
            } else if (!conn.enabled && config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(new MachineConnConfig(config, conn));
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
        description: 'Get a connection',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const conn = await config.models.Connection.from(req.params.connectionid);
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
        description: 'Refresh a connection',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const conn = await config.models.Connection.from(req.params.connectionid);

            if (!conn.enabled) throw new Err(400, null, 'Connection is not currently enabled');

            if (config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(new MachineConnConfig(config, conn));
            } else {
                await config.conns.add(new MachineConnConfig(config, conn));
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
        description: 'Delete a connection',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {}, req.params.connectionid);

            if (await config.models.Layer.count({
                where: sql`connection = ${req.params.connectionid}`
            }) > 0) throw new Err(400, null, 'Connection has active Layers - Delete layers before deleting Connection');

            if (await config.models.ConnectionSink.count({
                where: sql`connection = ${req.params.connectionid}`
            }) > 0) throw new Err(400, null, 'Connection has active Sinks - Delete Sinks before deleting Connection');

            await config.models.Connection.delete(req.params.connectionid);

            await config.models.ConnectionToken.delete(sql`
                connection = ${req.params.connectionid}
            `);

            config.conns.delete(req.params.connectionid);

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
        description: 'Return Conn Success/Failure Stats',
        params: Type.Object({
            connectionid: Type.Integer()
        }),
        res: Type.Object({
            stats: Type.Array(Type.Object({
                label: Type.String(),
                success: Type.Integer()
            }))
        })
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const conn = await config.models.Connection.from(req.params.connectionid);

            const stats = await cw.connection(conn.id);

            const timestamps: Set<Date> = new Set();
            const map: Map<string, number> = new Map();

            if (!stats.length) {
                return res.json({ stats: [] });
            }

            const stat = stats[0];

            if (!stat.Timestamps) stat.Timestamps = [];
            if (!stat.Values) stat.Values = [];

            for (let i = 0; i < stat.Timestamps.length; i++) {
                timestamps.add(stat.Timestamps[i]);
                map.set(String(stat.Timestamps[i]), Number(stat.Values[i]));
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
                }>
            } = { stats: [] }

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
