import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Config from '../lib/config.js';
import { Response } from 'express';
import { AuthRequest } from '@tak-ps/blueprint-login';
import { Param } from '@openaddresses/batch-generic';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server', {
        name: 'Get Server',
        group: 'Server',
        description: 'Get Server',
        res: 'res.Server.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req);

            if (!config.server.auth) {
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

    await schema.patch('/server', {
        name: 'Patch Server',
        group: 'Server',
        description: 'Patch Server',
        body: 'req.body.Server.json',
        res: 'res.Server.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(config.models, req);

            if (!config.server) throw new Err(400, null, 'Cannot patch a server that hasn\'t been created');

            config.server = await config.models.Server.commit(config.server.id, {
                ...req.body,
                updated: sql`Now()`,
            });

            await config.conns.refresh();

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
