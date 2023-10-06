import Err from '@openaddresses/batch-error';
// @ts-ignore
import Connection from '../lib/types/connection.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/connection/:connectionid/channel', {
        name: 'List Channels',
        group: 'Connection',
        auth: 'admin',
        description: 'List channels that a given connection is broadcasting to',
        ':connectionid': 'integer',
        res: 'res.ConnectionChannels.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);
            const conn = await Connection.from(config.pool, req.params.connectionid);

            console.error(conn);

            return res.json(conn);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
