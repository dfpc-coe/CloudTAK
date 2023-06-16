import Err from '@openaddresses/batch-error';
// @ts-ignore
import Server from '../lib/types/server.js';
import Auth from '../lib/auth.js';
import { sql } from 'slonik';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';

export default async function router(schema: any, config: Config) {
    await schema.get('/server', {
        name: 'Get Server',
        group: 'Server',
        auth: 'user',
        description: 'Get Server',
        res: 'res.Server.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!config.server) {
                return res.json({
                    status: 'unconfigured'
                });
            } else {
                return res.json({
                    status: 'configured',
                    ...config.server
                });
            }
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.post('/server', {
        name: 'Post Server',
        group: 'Server',
        auth: 'user',
        description: 'Post Server',
        body: 'req.body.Server.json',
        res: 'res.Server.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (config.server) throw new Err(400, null, 'Cannot post to an existing server');

            config.server = await Server.generate(config.pool, req.body);
            await config.conns.refresh(config.pool, config.server);

            return res.json({
                status: 'configured',
                ...config.server
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });

    await schema.patch('/server', {
        name: 'Patch Server',
        group: 'Server',
        auth: 'user',
        description: 'Patch Server',
        body: 'req.body.Server.json',
        res: 'res.Server.json'
    }, async (req: AuthRequest, res: Response) => {
        try {
            await Auth.is_auth(req);

            if (!config.server) throw new Err(400, null, 'Cannot patch a server that hasn\'t been created');

            config.server = await config.server.commit(req.body);
            await config.conns.refresh(config.pool, config.server);

            return res.json({
                status: 'configured',
                updated: sql`Now()`,
                ...config.server
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
