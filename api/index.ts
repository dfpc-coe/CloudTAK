import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import cors from 'cors';
import express from 'express';
import { StandardResponse } from './lib/types.js';
import Bulldozer from './lib/initialization.js';
import history, {Context} from 'connect-history-api-fallback';
import Schema from '@openaddresses/batch-schema';
import { ProfileConnConfig } from './lib/connection-config.js';
import { ConnectionClient } from './lib/connection-pool.js';
import { ConnectionWebSocket } from './lib/connection-web.js';
import sleep from './lib/sleep.js';
import type WebSocket from 'ws';
import * as ws from 'ws';
import Config from './lib/config.js';
import ServerManager from './lib/server.js';
import { tokenParser, AuthUser } from './lib/auth.js'
import process from 'node:process';

type CliArgs = {
    silent?: boolean;
    nocache?: boolean;
    noevents?: boolean;
    nosinks?: boolean;
    nogeofence?: boolean;
    postgres?: string;
    env?: string;
};

const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
        silent: { type: 'boolean' },   // Turn off logging as much as possible
        nocache: { type: 'boolean' },  // Ignore MemCached
        noevents: { type: 'boolean' }, // Disable Initialization of Second Level Events
        nosinks: { type: 'boolean' },  // Disable Push to Sinks
        nogeofence: { type: 'boolean' }, // Disable Geofence Server Integration
        postgres: { type: 'string' },  // Postgres Connection String
        env: { type: 'string' }        // Load a non-default .env file --env local would read .env-local
    },
    allowPositionals: true,
    strict: false,
}) as { values: CliArgs };

const pkg = JSON.parse(String(fs.readFileSync(new URL('./package.json', import.meta.url))));

process.on('uncaughtExceptionMonitor', (exception, origin) => {
    console.trace('FATAL', exception, origin);
});

if (import.meta.url === `file://${process.argv[1]}`) {
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

    const config = await Config.env({
        silent: args.silent || false,
        noevents: args.noevents || false,
        postgres: process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_etl',
        nosinks: args.nosinks || false,
        nogeofence: args.nogeofence || false,
        nocache: args.nocache || false,
    });

    await server(config);
}

export default async function server(config: Config): Promise<ServerManager> {
    if (config.StackName !== 'test' || process.env.CLOUDTAK_Mode === 'docker-compose') {
        // If the database is empty, populate it with generally sensible defaults
        await Bulldozer.fireItUp(config);
    }

    if (!config.nogeofence) await config.geofence.init();
    await config.conns.init();

    if (!config.noevents) await config.events.init(config.pg);

    const websocketPort = Number(process.env.CLOUDTAK_WEBSOCKET_PORT || 4999);

    const app = express();

    const schema = new Schema(express.Router(), {
        prefix: '/api',
        logging: {
            skip: function (req, res) {
                return res.statusCode <= 399 && res.statusCode >= 200;
            }
        },
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
            if (!isNaN(Number(parsedParams.connection)) && Number.isInteger(Number(parsedParams.connection))) {
                let webClients = config.wsClients.get(parsedParams.connection)
                if (!webClients) webClients = [];
                webClients.push(new ConnectionWebSocket(ws, parsedParams.format));
                config.wsClients.set(parsedParams.connection, webClients);
                ws.send(JSON.stringify({ type: 'connected' }));
            } else if (auth instanceof AuthUser && parsedParams.connection === auth.email) {
                let client: ConnectionClient | undefined;
                let awaitSecure: Promise<void> | undefined;
                if (!config.conns.has(parsedParams.connection)) {
                    const profile = await config.models.Profile.from(parsedParams.connection);
                    if (!profile.auth.cert || !profile.auth.key) throw new Error('No Cert Found on profile');

                    client = await config.conns.add(new ProfileConnConfig(config, parsedParams.connection, profile.auth));
                    if (client.tak.client && !client.tak.client.authorized) {
                        awaitSecure = new Promise<void>((resolve) => (client as ConnectionClient).tak.once('secureConnect', resolve));
                    }
                } else {
                    client = config.conns.get(parsedParams.connection) as ConnectionClient;
                }

                const connClient = new ConnectionWebSocket(ws, parsedParams.format, client, auth.session);

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

                if (awaitSecure) await awaitSecure;
                ws.send(JSON.stringify({ type: 'connected' }));
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

    const websocketServer = http.createServer((req, res) => {
        if (req.url === '/api') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ version: pkg.version }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 404, message: 'Not Found' }));
        }
    });

    const handleWebSocketUpgrade = (request: http.IncomingMessage, socket: Parameters<typeof wss.handleUpgrade>[1], head: Buffer): void => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    };

    websocketServer.on('upgrade', handleWebSocketUpgrade);

    return new Promise((resolve, reject) => {
        let srvListening = false;
        let settled = false;

        const srv = app.listen(5001);

        const rejectStartup = (err: Error): void => {
            if (settled) return;

            settled = true;
            srv.off('error', rejectStartup);
            websocketServer.off('error', rejectStartup);

            if (srvListening) {
                srv.close(() => {
                    reject(err);
                });
                return;
            }

            reject(err);
        };

        srv.once('error', rejectStartup);
        websocketServer.once('error', rejectStartup);

        srv.once('listening', () => {
            srvListening = true;

            if (!config.silent) {
                if (process.env.CLOUDTAK_Mode === 'docker-compose') {
                    console.log('ok - http://localhost:5000');
                } else {
                    console.log('ok - http://localhost:5001');
                }
            }

            websocketServer.listen(websocketPort);
        });

        websocketServer.once('listening', () => {
            if (settled) return;

            settled = true;
            srv.off('error', rejectStartup);
            websocketServer.off('error', rejectStartup);

            if (!config.silent) console.log(`ok - websocket server listening on ${websocketPort}`);

            const sm = new ServerManager(srv, wss, config, websocketServer);
            return resolve(sm);
        });

        srv.on('upgrade', handleWebSocketUpgrade);

        srv.on('close', async () => {
            await config.geofence.close();
            await config.conns.close();
        });
    });
}

