import { Static, Type } from '@sinclair/typebox'
import { X509Certificate } from 'crypto';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../lib/auth.js';
import { sql } from 'drizzle-orm';
import Config from '../lib/config.js';
import { ServerResponse } from '../lib/types.js';
import TAKAPI, {
    APIAuthCertificate,
    APIAuthPassword
} from '../lib/tak-api.js';

export default async function router(schema: Schema, config: Config) {
    await schema.get('/server', {
        name: 'Get Server',
        group: 'Server',
        description: 'Get Server',
        res: ServerResponse
    }, async (req, res) => {
        try {
            if (!config.server.auth.key || !config.server.auth.cert) {
                res.json({
                    id: 1,
                    status: 'unconfigured',
                    name: 'Default Server',
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    url: '',
                    api: '',
                    webtak: '',
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

                    res.json(response)
                } else {
                    res.json({
                        id: config.server.id,
                        status: 'configured',
                        name: config.server.name,
                        created: config.server.created,
                        updated: config.server.updated,
                        url: config.server.url,
                        api: config.server.api,
                        webtak: config.server.webtak,
                        auth
                    })
                }
            }
        } catch (err) {
             Err.respond(err, res);
        }
    });

    await schema.patch('/server', {
        name: 'Patch Server',
        group: 'Server',
        description: 'Patch Server',
        body: Type.Object({
            url: Type.String(),
            api: Type.String(),
            webtak: Type.String(),
            name: Type.Optional(Type.String()),

            // Used during initial server config to test connection & set system admin
            username: Type.Optional(Type.String()),
            password: Type.Optional(Type.String()),

            auth: Type.Optional(Type.Object({
                cert: Type.String(),
                key: Type.String(),
            }))
        }),
        res: ServerResponse
    }, async (req, res) => {
        try {
            if (config.server.auth.key && config.server.auth.cert) {
                await Auth.as_user(config, req, { admin: true });
            }

            if (!config.server) throw new Err(400, null, 'Cannot patch a server that hasn\'t been created');

            if (req.body.auth) {
                const api = await TAKAPI.init(
                    new URL(String(req.body.api)),
                    new APIAuthCertificate(req.body.auth.cert, req.body.auth.key)
                );

                const config = await api.Files.config();
                if (config.uploadSizeLimit === undefined) {
                    throw new Err(400, null, 'Could not connect to TAK Server');
                }
            }

            // An unconfigured server will set the first successful username/pass as a CloudTAK System Admin
            if (!config.server.auth.key && !config.server.auth.cert && req.body.username && req.body.password) {
                const auth = new APIAuthPassword(req.body.username, req.body.password)
                const api = await TAKAPI.init(new URL(req.body.webtak), auth);

                const certs = await api.Credentials.generate();

                await config.models.Profile.generate({
                    auth: certs,
                    username: req.body.username,
                    system_admin: true
                });
            } else if (!config.server.auth.key && !config.server.auth.cert && (!req.body.username || !req.body.password)) {
                throw new Err(400, null, 'Initial configuration must include valid TAK Username & Password to set System Administrator');
            }

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

            res.json(response);
        } catch (err) {
             Err.respond(err, res);
        }
    });
}
