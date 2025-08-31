import Err from '@openaddresses/batch-error';
import S3 from '../lib/aws/s3.js';
import { sql, and, inArray } from 'drizzle-orm';
import Config from '../lib/config.js';
import Auth, { AuthResourceAccess } from '../lib/auth.js';
import { X509Certificate } from 'crypto';
import { Type } from '@sinclair/typebox'
import { StandardResponse, ConnectionResponse } from '../lib/types.js';
import { Connection } from '../lib/schema.js';
import { MachineConnConfig } from '../lib/connection-config.js';
import Schema from '@openaddresses/batch-schema';
import * as Default from '../lib/limits.js';
import { generateP12 } from '../lib/certificate.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/connection', {
        name: 'List Connections',
        group: 'Connection',
        description: 'List Connections',
        query: Type.Object({
            limit: Default.Limit,
            page: Default.Page,
            order: Default.Order,
            sort: Type.String({
                default: 'created',
                enum: Object.keys(Connection)
            }),
            filter: Default.Filter
        }),
        res: Type.Object({
            total: Type.Integer(),
            status: Type.Object({
                dead: Type.Integer({ description: 'The connection is not currently connected to a TAK server' }),
                live: Type.Integer({ description: 'The connection is currently connected to a TAK server' }),
                unknown: Type.Integer({ description: 'The status of the connection could not be determined' }),
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
                    const { validFrom, validTo, subject } = new X509Certificate(conn.auth.cert);

                    return {
                        status: config.conns.status(conn.id),
                        certificate: { validFrom, validTo, subject },
                        ...conn
                    }
                })
            }

            for (const conn of config.conns.values()) {
                if (!conn.tak) json.status.unknown++;
                else json.status.live++;
            }

            res.json(json);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection', {
        name: 'Create Connection',
        group: 'Connection',
        description: 'Register a new connection',
        body: Type.Object({
            name: Default.NameField,
            description: Default.DescriptionField,
            readonly: Type.Boolean({ default: false }),
            enabled: Type.Boolean({ default: true }),
            agency: Type.Optional(Type.Union([Type.Null(), Type.Integer({ minimum: 1 })])),
            integrationId: Type.Optional(Type.Integer()),
            auth: Type.Object({
                key: Type.String({ minLength: 1, maxLength: 4096 }),
                cert: Type.String({ minLength: 1, maxLength: 4096 })
            })
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);

            if (!req.body.agency && user.access !== 'admin') {
                throw new Err(400, null, 'Only System Admins can create a server without an Agency Configured');
            } else if (req.body.agency && user.access !== 'admin') {
                if (!profile.agency_admin || !profile.agency_admin.includes(req.body.agency)) {
                    throw new Err(400, null, 'Cannot create a connection for an Agency you are not an admin of');
                }
            }

            if (!config.server) {
                throw new Err(400, null, 'TAK Server must be configured before a connection can be made');
            }

            if (req.body.readonly) {
                req.body.enabled = false;
            }

            const conn = await config.models.Connection.generate({
                ...req.body,
                username: user.email
            });

            if (conn.enabled) await config.conns.add(new MachineConnConfig(config, conn));

            const { validFrom, validTo, subject } = new X509Certificate(conn.auth.cert);

            if (req.body.integrationId && config.external && config.external.configured) {
                if (!profile.id) throw new Err(400, null, 'External ID must be set on profile');

                await config.external.updateIntegrationConnectionId(profile.id, {
                    connection_id: conn.id,
                    integration_id: req.body.integrationId
                })
            }

            res.json({
                status: config.conns.status(conn.id),
                certificate: { validFrom, validTo, subject },
                ...conn
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.patch('/connection/:connectionid', {
        name: 'Update Connection',
        group: 'Connection',
        description: 'Update a connection',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        body: Type.Object({
            name: Type.Optional(Default.NameField),
            description: Type.Optional(Default.DescriptionField),
            enabled: Type.Optional(Type.Boolean()),
            agency: Type.Union([Type.Null(), Type.Optional(Type.Integer({ minimum: 1 }))]),
            auth: Type.Optional(Type.Object({
                key: Type.String({ minLength: 1, maxLength: 4096 }),
                cert: Type.String({ minLength: 1, maxLength: 4096 })
            }))
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (req.body.agency && await Auth.is_user(config, req)) {
                const user = await Auth.as_user(config, req, { admin: true });
                if (!user) throw new Err(400, null, 'Only System Admins can change an agency once a connection is created');
            }

            if (connection.readonly) {
                req.body.enabled = false;
            }

            const conn = await config.models.Connection.commit(req.params.connectionid, {
                updated: sql`Now()`,
                ...req.body
            });

            if (conn.enabled && !config.conns.has(conn.id)) {
                await config.conns.add(new MachineConnConfig(config, conn));
            } else if (conn.enabled && config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
                await config.conns.add(new MachineConnConfig(config, conn));
            } else if (!conn.enabled && config.conns.has(conn.id)) {
                await config.conns.delete(conn.id);
            }

            const { validFrom, validTo, subject } = new X509Certificate(conn.auth.cert);

            res.json({
                status: config.conns.status(conn.id),
                certificate: { validFrom, validTo, subject },
                ...conn
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid', {
        name: 'Get Connection',
        group: 'Connection',
        description: 'Get a connection',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            const { validFrom, validTo, subject } = new X509Certificate(connection.auth.cert);

            res.json({
                status: config.conns.status(connection.id),
                certificate: { validFrom, validTo, subject },
                ...connection
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/connection/:connectionid/auth', {
        name: 'Get Connection Auth',
        group: 'Connection',
        description: 'Connections that are marked as ReadOnly are used for external integrations and are able to download the X509 Certificate',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 }),
        }),
        query: Type.Object({
            token: Type.Optional(Type.String()),
            download: Type.Boolean({
                default: false,
                description: 'Download auth as P12 file'
            })
        }),
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                token: true,
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (connection.readonly === false) {
                throw new Err(400, null, 'Connection is not ReadOnly and cannot return auth');
            }

            const buff = await generateP12(
                connection.auth.key,
                connection.auth.cert
            );

            if (req.query.download) {
                res.setHeader('Content-Disposition', `attachment; filename="connection-auth-${connection.id}.p12"`);
            }

            res.setHeader('Content-Type', 'application/x-pkcs12');
            res.write(buff);
            res.end();
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/connection/:connectionid/refresh', {
        name: 'Refresh Connection',
        group: 'Connection',
        description: 'Refresh a connection',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        res: ConnectionResponse
    }, async (req, res) => {
        try {
            const { connection } = await Auth.is_connection(config, req, {
                resources: [{ access: AuthResourceAccess.CONNECTION, id: req.params.connectionid }]
            }, req.params.connectionid);

            if (!connection.enabled) throw new Err(400, null, 'Connection is not currently enabled');

            if (config.conns.has(connection.id)) {
                await config.conns.delete(connection.id);
                await config.conns.add(new MachineConnConfig(config, connection));
            } else {
                await config.conns.add(new MachineConnConfig(config, connection));
            }

            const { validFrom, validTo, subject } = new X509Certificate(connection.auth.cert);

            res.json({
                status: config.conns.status(connection.id),
                certificate: { validFrom, validTo, subject },
                ...connection
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.delete('/connection/:connectionid', {
        name: 'Delete Connection',
        group: 'Connection',
        description: 'Delete a connection',
        params: Type.Object({
            connectionid: Type.Integer({ minimum: 1 })
        }),
        res: StandardResponse
    }, async (req, res) => {
        try {
            await Auth.is_connection(config, req, {}, req.params.connectionid);

            if (await config.models.Layer.count({
                where: sql`connection = ${req.params.connectionid}`
            }) > 0) throw new Err(400, null, 'Connection has active Layers - Delete layers before deleting Connection');

            if (await config.models.Data.count({
                where: sql`connection = ${req.params.connectionid}`
            }) > 0) throw new Err(400, null, 'Connection has active Data Syncs - Delete Syncs before deleting Connection');

            if (await config.models.VideoLease.count({
                where: sql`connection = ${req.params.connectionid}`
            }) > 0) throw new Err(400, null, 'Connection has active Video LEases - Delete Leases before deleting Connection');

            await S3.del(`connection/${String(req.params.connectionid)}/`, { recurse: true });

            await config.models.ConnectionToken.delete(sql`
                connection = ${req.params.connectionid}
            `);

            await config.models.Connection.delete(req.params.connectionid);

            config.conns.delete(req.params.connectionid);

            if (config.external && config.external.configured) {
                const user = await Auth.as_user(config, req);
                const profile = await config.models.Profile.from(user.email);

                if (profile.id) {
                    // I don't know how to figure out if the connection was created with a machine user and hence registered
                    // with COTAK, so just firing off the delete, which won't error out if no integration found.
                    await config.external.deleteIntegrationByConnectionId(profile.id, {
                        connection_id: req.params.connectionid,
                    })
                }
            }


            res.json({
                status: 200,
                message: 'Connection Deleted'
            });
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
