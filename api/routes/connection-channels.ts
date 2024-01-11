import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.ts';
import Config from '../lib/config.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import TAKAPI, { APIAuthCertificate, } from '../lib/tak-api.ts';
import Modeler from '../lib/drizzle.ts';
import { Connection } from '../lib/schema.ts';

export default async function router(schema: any, config: Config) {
    const ConnectionModel = new Modeler(config.pg, Connection);

    await schema.get('/connection/:connectionid/channel', {
        name: 'List Channels',
        group: 'Connection',
        auth: 'admin',
        description: 'List channels that a given connection is broadcasting to',
        ':connectionid': 'integer',
        res: 'res.Marti.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);
            const conn = await ConnectionModel.from(parseInt(req.params.connectionid));

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
