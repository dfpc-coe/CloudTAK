import Err from '@openaddresses/batch-error';
// @ts-ignore
import ConnectionSink from '../lib/types/connection-sink.js';
import Auth from '../lib/auth.js';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/connection/:connectionid/sink', {
        name: 'List Sinks',
        group: 'ConnectionSink',
        auth: 'user',
        description: 'List Sinks',
        ':connectionid': 'integer',
        query: 'req.query.ListConnectionSinks.json',
        res: 'res.ListConnectionSinks.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            const list = await ConnectionSink.list(config.pool, req.query);

            return res.json(list);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
