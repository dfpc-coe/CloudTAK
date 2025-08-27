import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { StandardResponse } from './lib/types.js';
import Bulldozer from './lib/initialization.js';
import history, {Context} from 'connect-history-api-fallback';
import Schema from '@openaddresses/batch-schema';
import { ProfileConnConfig } from './lib/connection-config.js';
import minimist from 'minimist';
import { ConnectionWebSocket } from './lib/connection-web.js';
import sleep from './lib/sleep.js';
import type WebSocket from 'ws';
import * as ws from 'ws';
import Config from './lib/config.js';
import ServerManager from './lib/server.js';
import { tokenParser, AuthUser } from './lib/auth.js'
import process from 'node:process';

const args = minimist(process.argv, {
    boolean: [
        'silent',   // Turn off logging as much as possible
        'nocache',  // Ignore MemCached
        'noevents', // Disable Initialization of Second Level Events
        'nosinks',  // Disable Push to Sinks
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
    if (err instanceof Error && err.message.startsWith('ENOENT')) {
        console.log('ok - no .env file loaded - none found');
    } else {
        console.log('ok - no .env file loaded', err);
    }
}

const pkg = JSON.parse(String(fs.readFileSync(new URL('./package.json', import.meta.url))));

process.on('uncaughtExceptionMonitor', (exception, origin) => {
    console.trace('FATAL', exception, origin);
});

if (import.meta.url === `file://${process.argv[1]}`) {
    const config = await Config.env({
        silent: args.silent || false,
        noevents: args.noevents || false,
        postgres: process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_etl',
        nosinks: args.nosinks || false,
        nocache: args.nocache || false,
    });

    await server(config);
}

export default async function server(config: Config): Promise<ServerManager> {
    try {
        await config.cacher.flush();
    } catch (err) {
        console.log(`ok - failed to flush cache: ${err instanceof Error? err.message : String(err)}`);
    }

    if (config.StackName !== 'test') {
        // If the database is empty, populate it with generally sensible defaults
        await Bulldozer.fireItUp(config);
    }

    await config.conns.init();

    if (!config.noevents) await config.events.init(config.pg);

    const app = express();

    const schema = new Schema(express.Router(), {
        prefix: '/api',
        logging: true,
        limit: 50,
        error: {
            400: StandardResponse,
            401: StandardResponse,
            403: StandardResponse,
            404: StandardResponse,
            500: StandardResponse,
        },
        openapi: {
            info: {
                title: 'CloudTAK API',
                version: pkg.version,
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            },
            security: [{
                bearerAuth: []
            }],
        }
    });

    app.disable('x-powered-by');
    app.use(cors({
        origin: '*',
        exposedHeaders: [
            'Content-Disposition'
        ],
        allowedHeaders: [
            'Content-Type',
            'Content-Length',
            'User-Agent',
            'Authorization',
            'MissionAuthorization',
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
        res.json({
            version: pkg.version
        });
    });

    app.use('/api', schema.router);

    await schema.api();

    await schema.load(
        new URL('./routes/', import.meta.url),
        config,
        {
            silent: !!config.silent
        }
    );


    app.use('/fonts', express.static('fonts/'));

    app.use(history({
        rewrites: [{
            from: /.*\/js\/.*$/,
            to(context: Context) {
                if (!context.parsedUrl.pathname) context.parsedUrl.pathname = ''
                return context.parsedUrl.pathname.replace(/.*\/js\//, '/js/');
            }
        },{
            from: /.*$/,
            to(context: Context) {
                if (!context.parsedUrl.pathname) context.parsedUrl.pathname = ''
                if (!context.parsedUrl.path) context.parsedUrl.path = ''
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

    const WebSocketServer = ws.WebSocketServer ? ws.WebSocketServer : ws.default.WebSocketServer;

    const wss = new WebSocketServer({
        noServer: true
    }).on('connection', async (ws: WebSocket, request) => {
        try {
            if (!request.url) throw new Error('Could not parse connection URL');
            const params = new URLSearchParams(request.url.replace(/.*\?/, ''));
            // TODO: Remove connections

            if (!params.get('connection')) throw new Error('Connection Parameter Required');
            if (!params.get('token')) throw new Error('Token Parameter Required');
            const parsedParams = {
                connection: String(params.get('connection')),
                token: String(params.get('token')),
                format: String(params.get('format') || 'raw')
            }

            const auth = await tokenParser(config, parsedParams.token, config.SigningSecret);

            if (!config.wsClients.has(parsedParams.connection)) config.wsClients.set(parsedParams.connection, [])

            if (!config.conns) throw new Error('Server not configured with Connection Pool');

            // Connect to MachineUser Connection if it is an integer
            if (!isNaN(parseInt(parsedParams.connection))) {
                let webClients = config.wsClients.get(parsedParams.connection)
                if (!webClients) webClients = [];
                webClients.push(new ConnectionWebSocket(ws, parsedParams.format));
                config.wsClients.set(parsedParams.connection, webClients);
            } else if (auth instanceof AuthUser && parsedParams.connection === auth.email) {
                let client;
                if (!config.conns.has(parsedParams.connection)) {
                    const profile = await config.models.Profile.from(parsedParams.connection);
                    if (!profile.auth.cert || !profile.auth.key) throw new Error('No Cert Found on profile');

                    client = await config.conns.add(new ProfileConnConfig(config, parsedParams.connection, profile.auth));
                } else {
                    client = config.conns.get(parsedParams.connection);
                }

                const connClient = new ConnectionWebSocket(ws, parsedParams.format, client);

                let webClients = config.wsClients.get(parsedParams.connection)
                if (!webClients) webClients = [];
                webClients.push(connClient);
                config.wsClients.set(parsedParams.connection, webClients);

                ws.on('close', () => {
                    const conns = config.wsClients.get(parsedParams.connection);
                    if (!conns || !conns.length) return;

                    const i = webClients.indexOf(connClient);
                    if (i < 0) return;
                    webClients[i].destroy();
                    webClients.splice(i, 1);

                    if (webClients.length !== 0) return;

                    config.wsClients.delete(parsedParams.connection);

                    config.conns.delete(parsedParams.connection);
                })
            } else {
                throw new Error('Unauthorized');
            }
        } catch (err) {
            if (err instanceof Error && !err.message.includes('jwt expired')) {
                console.error('Error: WebSocket: ', err);
            }

            ws.send(JSON.stringify({
                type: 'Error',
                properties: {
                    message: err instanceof Error ? String(err.message) : String(err)
                }
            }));
            await sleep(500);
            ws.close();
        }
    });

    return new Promise((resolve) => {
        const srv = app.listen(5001, () => {
            if (!config.silent) {
                if (process.env.CLOUDTAK_Mode === 'docker-compose') {
                    console.log('ok - http://localhost:5000');
                } else {
                    console.log('ok - http://localhost:5001');
                }
            }

            const sm = new ServerManager(srv, wss, config);
            return resolve(sm);
        });

        srv.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });

        srv.on('close', async () => {
            await config.conns.close();
        });
    });
}

