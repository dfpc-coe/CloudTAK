import { Static, Type } from '@sinclair/typebox'
import { X509Certificate } from 'crypto';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
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
            if (config.configure || !config.server.auth.key || !config.server.auth.cert) {
                return res.json({
                    id: 1,
                    status: config.configure ? 'empty' : 'unconfigured',
                    name: 'Default Server',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    url: '',
                    api: '',
                    auth: false
                });
            } else {
                const user = await Auth.as_user(config, req);

                let auth = false
                if (config.server.auth.cert && config.server.auth.key) {
                    auth = true;
                }

                if (user.access === AuthUserAccess.ADMIN) {
                    const response: Static<typeof ServerResponse> = {
                            status: 'configured',
                            ...config.server,
                            auth
                    };

                    if (config.server.auth.cert && config.server.auth.key) {
                        const { validFrom, validTo, subject } = new X509Certificate(config.server.auth.cert);
                        response.certificate = { validFrom, validTo, subject };
                    }

                    return res.json(response)
                } else {
                    return res.json({
                        id: config.server.id,
                        status: 'configured',
                        name: config.server.name,
                        created: config.server.created,
                        updated: config.server.updated,
                        url: config.server.url,
                        api: config.server.api,
                        auth
                    })
                }
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

            const response: Static<typeof ServerResponse> = {
                    status: 'configured',
                    ...config.server,
                    auth
            };

            if (config.server.auth.cert && config.server.auth.key) {
                const { validFrom, validTo, subject } = new X509Certificate(config.server.auth.cert);
                response.certificate = { validFrom, validTo, subject };
            }

            return res.json(response);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
