import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI from '../lib/tak-api.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/marti/group', {
        name: 'List Groups',
        group: 'Marti',
        auth: 'user',
        description: 'Helper API to list groups that the client is part of',
        res: 'res.MartiGroups.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!req.auth.email) throw new Err(400, null, 'Groups can only be listed by a JWT authenticated user');

            const api = new TAKAPI(new URL(config.MartiAPI), req.auth.token);

            const groups = await api.Groups.list();

            return res.json(groups);
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/marti/signClient', {
        name: 'Sign Client',
        group: 'Marti',
        auth: 'user',
        description: 'Helper API for obtaining a signed Certificate pair given LDAP Credentials',
        body: 'req.body.MartiSignClient.json',
        res: 'res.MartiSignClient.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const api = new TAKAPI(new URL(config.MartiAPI), req.body);
            await api.login();

            const certs = await api.Credentials.generate();

            return res.json(certs);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
