import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.ts';
import { sql } from 'drizzle-orm';
import Config from '../lib/config.ts';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { Server } from '../lib/schema.ts';
import Modeler, { Param } from '@openaddresses/batch-generic';

export default async function router(schema: any, config: Config) {
    const ServerModel = new Modeler<typeof Server>(config.pg, Server);

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
                    ...config.server,
                    auth: config.server.auth.cert && config.server.auth.key,
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

            config.server = await ServerModel.generate(req.body);
            await config.conns.refresh(config.server);

            return res.json({
                status: 'configured',
                ...config.server,
                auth: config.server.auth.cert && config.server.auth.key
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

            config.server = await ServerModel.commit(config.server.id, {
                ...req.body,
                updated: sql`Now()`,
            });

            await config.conns.refresh(config.server);

            return res.json({
                status: 'configured',
                ...config.server,
                auth: config.server.auth.cert && config.server.auth.key
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
