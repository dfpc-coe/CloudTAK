import { Type } from '@sinclair/typebox'
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Config from '../lib/config.js';
import { ServerResponse } from '../lib/types.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server', {
        name: 'Get Server',
        group: 'Server',
        description: 'Get Server',
        res: ServerResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            if (!config.server.auth) {
                return res.json({
                    id: 1,
                    status: 'unconfigured',
                    name: 'Default Server',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    url: '',
                    api: '',
                    provider_url: '',
                    provider_client: '',
                    provider_secret: '',
                    auth: false
                });
            } else {
                let auth = false
                if (config.server.auth.cert && config.server.auth.key) auth = true;

                return res.json({
                    status: 'configured',
                    ...config.server,
                    auth
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
        body: Type.Object({
            url: Type.String(),
            api: Type.String(),
            name: Type.Optional(Type.String()),
            provider_url: Type.Optional(Type.String()),
            provider_secret: Type.Optional(Type.String()),
            provider_client: Type.Optional(Type.String()),
            auth: Type.Optional(Type.Object({
                cert: Type.String(),
                key: Type.String(),
            }))
        }),
        res: ServerResponse
    }, async (req, res) => {
        try {
            await Auth.as_user(config, req, { admin: true });

            if (!config.server) throw new Err(400, null, 'Cannot patch a server that hasn\'t been created');

            config.server = await config.models.Server.commit(config.server.id, {
                ...req.body,
                updated: sql`Now()`,
            });

            await config.conns.refresh();

            let auth = false
            if (config.server.auth.cert && config.server.auth.key) auth = true;

            return res.json({
                status: 'configured',
                ...config.server,
                auth
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
