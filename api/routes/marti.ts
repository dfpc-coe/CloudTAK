import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthUser, AuthResource } from '@tak-ps/blueprint-login';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI, {
    APIAuthPassword,
    APIAuthCertificate
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/group', {
        name: 'List Groups',
        group: 'Marti',
        description: 'Helper API to list groups that the client is part of',
        query: {
            type: 'object',
            properties: {
                connection: {
                    type: 'integer',
                    description: 'Use Connection auth'
                },
                useCache: {
                    type: 'boolean',
                    description: 'This tells TAK server to return the users cached group selection vs the groups that came directly from the auth backend.'
                }
            }
        },
        res: 'res.Marti.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req);

            let api;
            if (req.query.connection) {
                const connection = await config.models.Connection.from(parseInt(String(req.query.connection)));
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

            } else {
                const user = await Auth.as_user(config.models, req);
                const profile = await config.models.Profile.from(user.email);
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            }

            const query: Record<string, string> = {};
            for (const q in req.query) query[q] = String(req.query[q]);

            const groups = await api.Group.list(query);

            return res.json(groups);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.put('/marti/group', {
        name: 'Upate Groups',
        group: 'Marti',
        description: 'Helper API to update groups that the client is part of',
        query: {
            type: 'object',
            properties: {
                clientUid: { type: 'string' },
                connection: { type: 'integer' }
            }
        },
        body: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'direction', 'created', 'type', 'bitpos', 'active'],
                properties: {
                    name: { type: "string" },
                    direction: { type: "string" },
                    created: { type: 'string' },
                    type: { type: "string" },
                    bitpos: { type: 'integer' },
                    active: { type: 'boolean' },
                    description: { type: "string" }
                }
            }
        },
        res: 'res.Marti.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req);

            let api;
            if (req.query.connection) {
                const connection = await config.models.Connection.from(parseInt(String(req.query.connection)));
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

            } else {
                const user = await Auth.as_user(config.models, req);
                const profile = await config.models.Profile.from(user.email);
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            }

            const query: Record<string, string> = {};
            for (const q in req.query) query[q] = String(req.query[q]);

            await api.Group.update(req.body, {});

            const groups = await api.Group.list(query);

            return res.json(groups);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.get('/marti/api/contacts/all', {
        name: 'List Contacts',
        group: 'Marti',
        description: 'Helper API to list contacts',
        res: 'res.Marti.json'
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config.models, req);
            const profile = await config.models.Profile.from(user.email);
            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));

            const contacts = await api.Contacts.list();

            return res.json(contacts);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/marti/signClient', {
        name: 'Sign Client',
        group: 'Marti',
        description: 'Helper API for obtaining a signed Certificate pair given LDAP Credentials',
        body: 'req.body.MartiSignClient.json',
        res: 'res.MartiSignClient.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req);

            const api = await TAKAPI.init(new URL(config.MartiAPI), new APIAuthPassword(req.body.username, req.body.password));

            const certs = await api.Credentials.generate();

            return res.json(certs);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
