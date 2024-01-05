import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import express, { Request, Response } from 'express';
import SwaggerUI from 'swagger-ui-express';
import history, {Context} from 'connect-history-api-fallback';
// @ts-ignore
import Schema from '@openaddresses/batch-schema';
// @ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import minimist from 'minimist';
import ConnectionPool, { ConnectionWebSocket, sleep } from './lib/connection-pool.js';
import EventsPool from './lib/events-pool.js';
import { WebSocket, WebSocketServer } from 'ws';
import Cacher from './lib/cacher.js';
import BlueprintLogin, { tokenParser } from '@tak-ps/blueprint-login';
import Server from './lib/types/server.js';
import Config from './lib/config.js';
import Profile from './lib/types/profile.js';
import TAKAPI, { APIAuthPassword } from './lib/tak-api.js';
import process from 'node:process';

import * as pgschema from './lib/schema.js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const args = minimist(process.argv, {
    boolean: [
        'silent',   // Turn off logging as much as possible
        'nocache',  // Ignore MemCached
        'unsafe',   // Allow unsecure local dev creds
        'noevents', // Disable Initialization of Second Level Events
        'nometrics', // Disable Sending AWS CloudWatch Metrics about each conn
        'nosinks',  // Disable Push to Sinks
        'local'     // (experimental) Disable external calls on startup (for developing in low connectivity)
                    // Note this is the min for serving requests - it doesn't make it particularly functional
    ],
    string: [
        'postgres', // Postgres Connection String
        'env'       // Load a non-default .env file --env local would read .env-local
    ],
});

try {
    const dotfile = new URL(`.env${args.env ? '-' + args.env : ''}`, import.meta.url);

    fs.accessSync(dotfile);

    process.env = Object.assign(JSON.parse(String(fs.readFileSync(dotfile))), process.env);
} catch (err) {
    console.log('ok - no .env file loaded');
}

const pkg = JSON.parse(String(fs.readFileSync(new URL('./package.json', import.meta.url))));

if (import.meta.url === `file://${process.argv[1]}`) {
    const config = await Config.env({
        silent: args.silent || false,
        unsafe: args.unsafe || false,
        noevents: args.noevents || false,
        nometrics: args.nometrics || false,
        nosinks: args.nosinks || false,
        local: args.local || false,
    });
    await server(config);
}

export default async function server(config: Config) {
    config.cacher = new Cacher(args.nocache, config.silent);

    try {
        await config.cacher.flush();
    } catch (err) {
        console.log(`ok - failed to flush cache: ${err.message}`);
    }

    config.pool = await Pool.connect(process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_etl', {
        schemas: {
            dir: new URL('./schema', import.meta.url)
        },
        parsing: {
            geometry: true
        }
    });

    const queryConnection = postgres(process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_etl');
    config.pg = drizzle(queryConnection, { schema: pgschema });


    try {
        config.server = await Server.from(config.pool, 1);
    } catch (err) {
        console.log(`ok - no server config found: ${err.message}`);
        config.server = null;
    }

    config.conns = new ConnectionPool(config, config.server, config.wsClients, config.StackName, config.local);
    await config.conns.init();
    config.events = new EventsPool(config.StackName);
    if (!config.noevents) await config.events.init(config.pool);

    const app = express();

    const schema = new Schema(express.Router(), {
        schemas: new URL('./schema', import.meta.url),
        openapi: true
    });

    app.disable('x-powered-by');
    app.use(cors({
        origin: '*',
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Content-Length',
            'x-requested-with'
        ],
        credentials: true
    }));

    /**
     * @api {get} /api Get Metadata
     * @apiVersion 1.0.0
     * @apiName Server
     * @apiGroup Server
     * @apiPermission public
     *
     * @apiDescription
     *     Return basic metadata about server configuration
     *
     * @apiSchema {jsonschema=./schema/res.Server.json} apiSuccess
     */
    app.get('/api', (req, res) => {
        return res.json({
            version: pkg.version
        });
    });

    app.use('/api', schema.router);

    await schema.api();

    const login = new BlueprintLogin({
        secret: config.SigningSecret,
        unsafe: config.unsafe ? config.UnsafeSigningSecret : undefined,
        group: config.AuthGroup,
        api: config.local ? 'http://localhost:5001' : config.MartiAPI
    });

    login.on('login', async (user) => {
        let profile;
        try {
            profile = await Profile.from(config.pool, user.username);
        } catch (err) {
            if (err.status === 404) {
                profile = await Profile.generate(config.pool, { username: user.username });
            } else {
                console.error(err);
            }
        }

        if (!profile.auth.cert || !profile.auth.key) {
            try {
            const api = await TAKAPI.init(new URL(config.MartiAPI), new APIAuthPassword(user.username, user.password));
            await profile.commit({ auth: await api.Credentials.generate() });
            } catch (err) {
                console.error(err);
            }
        }
    });

    await schema.blueprint(login);

    if (config.local) {
        // Mock WebTAK API to allow any username & Password
        app.get('/oauth/token', (req: Request, res: Response) => {
            return res.json({
                access_token: jwt.sign({
                    user_name: req.params.username
                }, config.SigningSecret)
            });
        });

        app.get('/Marti/api/groups/all', (req: Request, res: Response) => {
            return res.json({
                data: [{ name: config.AuthGroup}]
            });
        });
    }

    await schema.load(
        new URL('./routes/', import.meta.url),
        config,
        {
            silent: !!config.silent
        }
    );
    schema.not_found();
    schema.error();

    app.use('/docs', SwaggerUI.serve, SwaggerUI.setup(schema.docs.base));

    app.use(history({
        rewrites: [{
            from: /.*\/js\/.*$/,
            to(context: Context) {
                return context.parsedUrl.pathname.replace(/.*\/js\//, '/js/');
            }
        },{
            from: /.*$/,
            to(context: Context) {
                const parse = path.parse(context.parsedUrl.path);
                if (parse.ext) {
                    return context.parsedUrl.pathname;
                } else {
                    return '/';
                }
            }
        }]
    }));

    app.use(express.static('web/dist'));

    const wss = new WebSocketServer({
        noServer: true
    }).on('connection', async (ws: WebSocket, request) => {
        try {
            const params = new URLSearchParams(request.url.replace(/.*\?/, ''));
            // TODO: Remove connections

            if (!params.get('connection')) throw new Error('Connection Parameter Required');
            if (!params.get('token')) throw new Error('Token Parameter Required');

            const auth = tokenParser(params.get('token'), config.SigningSecret);

            if (!config.wsClients.has(params.get('connection'))) config.wsClients.set(params.get('connection'), [])

            // Connect to MachineUser Connection if it is an integer
            if (!isNaN(parseInt(params.get('connection')))) {
                config.wsClients.get(params.get('connection')).push(new ConnectionWebSocket(ws, params.get('format')));
            } else if (params.get('connection') === auth.email) {
                if (!config.conns.has(params.get('connection'))) {
                    const profile = await Profile.from(config.pool, params.get('connection'));
                    if (!profile.auth.cert || !profile.auth.key) throw new Error('No Cert Found on profile');

                    const client = await config.conns.add({
                        id: params.get('connection'),
                        name: params.get('connection'),
                        created: new Date(),
                        updated: new Date(),
                        enabled: true,
                        auth: profile.auth
                    }, true);

                    config.wsClients.get(params.get('connection')).push(new ConnectionWebSocket(ws, params.get('format'), client));
                } else {
                    const client = config.conns.get(params.get('connection'));
                    config.wsClients.get(params.get('connection')).push(new ConnectionWebSocket(ws, params.get('format'), client));
                }
            } else {
                throw new Error('Unauthorized');
            }
        } catch (err) {
            ws.send(JSON.stringify({type: 'Error', message: String(err.message) }));
            await sleep(500);
            ws.close();
        }
    });

    return new Promise((resolve) => {
        const srv = app.listen(5001, () => {
            if (!config.silent) console.log('ok - http://localhost:5001');
            return resolve(srv);
        });

        srv.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });
    });
}
