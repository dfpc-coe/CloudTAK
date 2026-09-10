import { Type } from '@sinclair/typebox';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { GenericMartiResponse } from '../../common/types.js';
import Auth, { AuthResource, AuthResourceAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';
import { ConnectionAuth } from '../../common/connection-config.js';
import { Contact } from '@tak-ps/node-tak/lib/api/contacts';
import { Group } from '@tak-ps/node-tak/lib/api/groups';
import { ClientEndpoint } from '@tak-ps/node-tak/lib/api/client';
import { TAKList } from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthPassword, APIAuthCertificate } from '@tak-ps/node-tak';
import type { Request } from 'express';
import { authenticatedProfile } from '../../common/control/profile.js';

/**
 * Resolve the TAK API client a Marti helper should act as.
 *
 * Connection & Layer resource tokens are scoped to a single Connection, so the
 * Connection is inferred from the token and the token must hold the given
 * `group:<level>` permission. User tokens act as the user's own
 * certificate unless `connection` is given - 0 selects the server certificate
 * (System Admin only), any other value a Connection the user administers.
 */
async function serverApi(config: ConfigStateless): Promise<TAKAPI> {
    if (!config.server.auth.cert || !config.server.auth.key) {
        throw new Err(400, null, 'Server certificate is not configured');
    }

    return await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(config.server.auth.cert, config.server.auth.key));
}

async function groupApi(
    config: ConfigStateless,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches Auth.as_user / Auth.is_connection
    req: Request<any, any, any, any>,
    connection?: number,
    scope?: string,
): Promise<TAKAPI> {
    const auth = await Auth.is_auth(config, req, {
        scope,
        resources: [
            { access: AuthResourceAccess.CONNECTION },
            { access: AuthResourceAccess.LAYER },
        ],
    });

    if (auth instanceof AuthResource) {
        let inferred: number;

        if (auth.access === AuthResourceAccess.LAYER) {
            if (auth.id === undefined) throw new Err(401, null, 'Layer Resource Token must contain a Layer ID');
            // Server-level Layers have no Connection and use the server certificate
            inferred = (await config.models.Layer.from(auth.id)).connection ?? 0;
        } else {
            if (auth.id === undefined) throw new Err(401, null, 'Connection Resource Token must contain a Connection ID');
            inferred = Number(auth.id);
        }

        if (connection !== undefined && connection !== inferred) {
            throw new Err(403, null, `Token is scoped to Connection ${inferred}`);
        }

        if (inferred === 0) {
            return await serverApi(config);
        }

        const { connection: conn } = await Auth.is_connection_auth(config, auth, inferred);
        return await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(conn.auth.cert, conn.auth.key));
    } else if (connection === undefined) {
        const profile = await authenticatedProfile(config, auth.email);
        return await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
    } else if (connection === 0) {
        await Auth.as_user(config, req, { admin: true });
        return await serverApi(config);
    } else {
        const { connection: conn } = await Auth.is_connection_auth(config, auth, connection);
        return await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(conn.auth.cert, conn.auth.key));
    }
}

export default async function router(schema: Schema, config: ConfigStateless) {
    await schema.get('/marti/group', {
        name: 'List Groups',
        group: 'Marti',
        description: 'Helper API to list groups that the client is part of. Pass connection to list the groups a Connection is part of, or connection=0 for the server certificate. Resource tokens require the `group:read` permission',
        query: Type.Object({
            connection: Type.Optional(Type.Integer({ minimum: 0, description: 'User tokens only - act as this Connection, or 0 for the server certificate (System Admin only). Connection & Layer tokens infer the Connection from the token' })),
            useCache: Type.Optional(Type.Boolean({ description: 'This tells TAK server to return the users cached group selection vs the groups that came directly from the auth backend.' })),
        }),
        res: TAKList(Group),
    }, async (req, res) => {
        try {
            const api = await groupApi(config, req, req.query.connection, 'group:read');

            const groups = await api.Group.list({
                useCache: req.query.useCache,
            });

            res.json(groups);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.put('/marti/group', {
        name: 'Update Groups',
        group: 'Marti',
        description: 'Helper API to update groups that the client is part of. Resource tokens require the `group:update` permission',
        query: Type.Object({
            clientUid: Type.Optional(Type.String()),
            connection: Type.Optional(Type.Integer({ minimum: 0, description: 'User tokens only - act as this Connection, or 0 for the server certificate (System Admin only). Connection & Layer tokens infer the Connection from the token' })),
        }),
        body: Type.Array(Type.Object({
            name: Type.String(),
            direction: Type.String(),
            created: Type.String(),
            type: Type.String(),
            bitpos: Type.Integer(),
            active: Type.Boolean(),
            description: Type.Optional(Type.String()),
        })),
        res: GenericMartiResponse,
    }, async (req, res) => {
        try {
            const api = await groupApi(config, req, req.query.connection, 'group:update');

            await api.Group.update(req.body, {});

            const groups = await api.Group.list({});

            res.json(groups);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/marti/clients', {
        name: 'List Clients',
        group: 'Marti',
        description: 'Helper API to list clients',
        query: Type.Object({
            connection: Type.Optional(Type.Integer({ minimum: 0, description: 'User tokens only - act as this Connection, or 0 for the server certificate (System Admin only). Connection & Layer tokens infer the Connection from the token' })),
            secago: Type.Integer({
                description: 'Number of seconds ago to look back for client updates. Default is 300 (5 minutes)',
                default: 300,
            }),
            groups: Type.Optional(Type.String()),
        }),
        res: TAKList(ClientEndpoint),
    }, async (req, res) => {
        try {
            const api = await groupApi(config, req, req.query.connection);

            const groupsRaw = req.query.groups
                ? req.query.groups.split(',')
                : undefined;

            const groups = Array.isArray(groupsRaw)
                ? (() => {
                        const cleaned = groupsRaw
                            .map(g => (g !== undefined && g !== null ? String(g).trim() : ''))
                            .filter(g => g.length > 0);
                        return cleaned.length > 0 ? cleaned : undefined;
                    })()
                : undefined;

            const clients = await api.Client.list({
                secAgo: req.query.secago,
                group: groups,
            });

            res.json(clients);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.get('/marti/api/contacts/all', {
        name: 'List Contacts',
        group: 'Marti',
        description: 'Helper API to list contacts',
        res: Type.Array(Contact),
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await authenticatedProfile(config, user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const contacts = await api.Contacts.list();

            res.json(contacts);
        } catch (err) {
            Err.respond(err, res);
        }
    });

    await schema.post('/marti/signClient', {
        name: 'Sign Client',
        group: 'Marti',
        description: 'Helper API for obtaining a signed Certificate pair given LDAP Credentials',
        body: Type.Object({
            username: Type.String(),
            password: Type.String(),
        }),
        res: ConnectionAuth,
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const api = await TAKAPI.init(new URL(config.server.webtak), new APIAuthPassword(req.body.username, req.body.password));
            const certs = await api.Credentials.generate();

            res.json(certs);
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
