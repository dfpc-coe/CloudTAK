import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import EsriProxy from '../lib/esri.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/sink/esri', {
        name: 'Validate & Auth',
        group: 'SinkEsri',
        auth: 'user',
        description: 'Helper API to configure ESRI MapServers - Validate and Authenticate Server',
        body: 'req.body.SinkEsriToken.json',
        res: 'res.SinkEsriToken.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const esri = await EsriProxy.generateToken(
                new URL(req.body.url),
                req.body.username,
                req.body.password
            );

            return res.json({
                token: esri.token
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
