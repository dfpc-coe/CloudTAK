import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI, { APIAuthCertificate, } from '../lib/tak-api.js';

export default async function router(schema: any, config: Config) {
    await schema.get('/connection/:connectionid/channel', {
        name: 'List Channels',
        group: 'Connection',
        auth: 'admin',
        description: 'List channels that a given connection is broadcasting to',
        ':connectionid': 'integer',
        res: 'res.Marti.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(config.models, req);
            const conn = await config.models.Connection.from(parseInt(req.params.connectionid));

            const api = await TAKAPI.init(new URL(String(config.server.api)), new APIAuthCertificate(conn.auth.cert, conn.auth.key));

            const list = await api.Group.list({
                useCache: 'true'
            });

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
