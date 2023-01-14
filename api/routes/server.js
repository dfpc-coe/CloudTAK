import Err from '@openaddresses/batch-error';
import Server from '../lib/types/server.js';
import Auth from '../lib/auth.js';
import { sql } from 'slonik';

export default async function router(schema, config) {
    await schema.get('/server', {
        name: 'Get Server',
        group: 'Server',
        auth: 'user',
        description: 'Get Server',
        res: 'res.Server.json'
    }, async (req, res) => {
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
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            if (config.server) throw new Error(400, null, 'Cannot post to an existing server');

            config.server = await Server.generate(config.pool, req.body);
            config.conns.server = config.server;

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
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            if (!config.server) throw new Error(400, null, 'Cannot patch a server that hasn\'t been created');

            config.server = await config.server.commit(req.body);
            config.conns.server = config.server;

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
