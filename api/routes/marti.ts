import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Request, Response } from 'express';
import TAKAPI from '../lib/tak-api.js';

export default async function router(schema: any, config: Config) {
    await schema.post('/marti/signClient', {
        name: 'Sign Client',
        group: 'Marti',
        auth: 'user',
        description: 'Helper API for obtaining a signed Certificate pair given LDAP Credentials',
        body: 'req.body.MartiSignClient.json',
        res: 'res.MartiSignClient.json'
    }, async (req: Request, res: Response) => {
        try {
            await Auth.is_auth(req);

            const api = new TAKAPI(new URL(config.MartiAPI), req.body);
            await api.login();

            return res.json({});
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
