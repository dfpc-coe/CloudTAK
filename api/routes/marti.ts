import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import { GenericMartiResponse } from '../lib/types.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { ConnectionAuth } from '../lib/connection-config.js';
import { Contact } from '@tak-ps/node-tak/lib/api/contacts'
import { Group } from '@tak-ps/node-tak/lib/api/groups'
import { TAKList } from '@tak-ps/node-tak/lib/api/types';
import { TAKAPI, APIAuthPassword, APIAuthCertificate } from '@tak-ps/node-tak';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/marti/group', {
        name: 'List Groups',
        group: 'Marti',
        description: 'Helper API to list groups that the client is part of',
        query: Type.Object({
            connection: Type.Optional(Type.Integer({ description: 'Use Connection auth' })),
            useCache: Type.Optional(Type.Boolean({ description: 'This tells TAK server to return the users cached group selection vs the groups that came directly from the auth backend.' })),
        }),
        res: TAKList(Group)
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            let api;
            if (req.query.connection) {
                const connection = await config.models.Connection.from(parseInt(String(req.query.connection)));
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

            } else {
                const user = await Auth.as_user(config, req);
                const profile = await config.models.Profile.from(user.email);
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            }

            const groups = await api.Group.list({
                useCache: req.query.useCache
            });

            res.json(groups);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.put('/marti/group', {
        name: 'Update Groups',
        group: 'Marti',
        description: 'Helper API to update groups that the client is part of',
        query: Type.Object({
            clientUid: Type.Optional(Type.String()),
            connection: Type.Optional(Type.Integer())
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
        res: GenericMartiResponse
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            let api;
            if (req.query.connection) {
                const connection = await config.models.Connection.from(parseInt(String(req.query.connection)));
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(connection.auth.cert, connection.auth.key));

            } else {
                const user = await Auth.as_user(config, req);
                const profile = await config.models.Profile.from(user.email);
                api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(profile.auth.cert, profile.auth.key));
            }

            await api.Group.update(req.body, {});

            const groups = await api.Group.list({});

            res.json(groups);
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.get('/marti/api/contacts/all', {
        name: 'List Contacts',
        group: 'Marti',
        description: 'Helper API to list contacts',
        res: Type.Array(Contact)
    }, async (req, res) => {
        try {
            const user = await Auth.as_user(config, req);
            const profile = await config.models.Profile.from(user.email);
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
            password: Type.String()
        }),
        res: ConnectionAuth
    }, async (req, res) => {
        try {
            await Auth.is_auth(config, req);

            const api = await TAKAPI.init(new URL(config.server.webtak), new APIAuthPassword(req.body.username, req.body.password));
            const certs = await api.Credentials.generate();

            console.error(certs);

            res.json(certs);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
