import Bulldozer from './lib/initialization.js';
import { ProfileConnConfig, AdminConnConfig } from './lib/connection-config.js';
import { ConnectionClient } from './lib/connection-pool.js';
import { ConnectionWebSocket } from './lib/connection-web.js';
import sleep from './lib/sleep.js';
import type WebSocket from 'ws';
import * as ws from 'ws';
import type { WebSocketServer as WSS } from 'ws';
import type { IncomingMessage } from 'node:http';
import Config from './lib/config.js';
import { tokenParser, AuthUser } from './lib/auth.js';
import process from 'node:process';

/**
 * Initialize all stateful subsystems - these maintain persistent connections
 * or in-memory state and as such must only ever run on a single container:
 *
 * - TAK Connection Pool (persistent TLS connections to the TAK Server)
 * - Geofence (persistent connection to the Tile38 Server)
 * - Events Pool (second level cron scheduling for Layers)
 */
export async function initState(config: Config): Promise<void> {
    if (config.StackName !== 'test' || process.env.CLOUDTAK_Mode === 'docker-compose') {
        // If the database is empty, populate it with generally sensible defaults
        await Bulldozer.fireItUp(config);
    }

    if (!config.nogeofence) await config.geofence.init();
    await config.conns.init();

    if (!config.noevents) await config.events.init(config.pg);
}

/**
 * Create the WebSocket Server which terminates client connections
 * and binds them to TAK Connections in the Connection Pool
 *
 * The returned server is created with `noServer: true` and must be
 * attached to an HTTP Server's `upgrade` event by the caller
 */
export function createWebSocketServer(config: Config): WSS {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WebSocketServer = ws.WebSocketServer ?? (ws as any).default.WebSocketServer;

    const wss: WSS = new WebSocketServer({
        noServer: true,
    }).on('connection', async (ws: WebSocket, request: IncomingMessage) => {
        try {
            if (!request.url) throw new Error('Could not parse connection URL');
            const params = new URLSearchParams(request.url.replace(/.*\?/, ''));
            // TODO: Remove connections

            if (!params.get('connection')) throw new Error('Connection Parameter Required');
            if (!params.get('token')) throw new Error('Token Parameter Required');
            const parsedParams = {
                connection: String(params.get('connection')),
                token: String(params.get('token')),
                format: String(params.get('format') || 'raw'),
            };

            const auth = await tokenParser(config, parsedParams.token, config.SigningSecret);

            if (!config.wsClients.has(parsedParams.connection)) config.wsClients.set(parsedParams.connection, []);

            if (!config.conns) throw new Error('Server not configured with Connection Pool');

            // Connect to MachineUser Connection if it is an integer
            if (!isNaN(Number(parsedParams.connection)) && Number.isInteger(Number(parsedParams.connection))) {
                let webClients = config.wsClients.get(parsedParams.connection);
                if (!webClients) webClients = [];
                webClients.push(new ConnectionWebSocket(ws, parsedParams.format));
                config.wsClients.set(parsedParams.connection, webClients);
                ws.send(JSON.stringify({ type: 'connected' }));
            } else if (parsedParams.connection === 'admin') {
                if (!(auth instanceof AuthUser) || !auth.is_admin()) {
                    throw new Error('Unauthorized');
                }

                // Admin connection using server auth profile
                let client: ConnectionClient | undefined;
                let awaitSecure: Promise<void> | undefined;

                if (!config.conns.has(0)) {
                    // Admin connection should already be created in init(), but check anyway
                    if (!config.server.connection) {
                        throw new Error('Admin connection is disabled');
                    } else if (config.server.auth.cert && config.server.auth.key) {
                        client = await config.conns.add(new AdminConnConfig(config));
                        if (client.tak.client && !client.tak.client.authorized) {
                            awaitSecure = new Promise<void>(resolve => (client as ConnectionClient).tak.once('secureConnect', resolve));
                        }
                    } else {
                        throw new Error('Admin connection not configured');
                    }
                } else {
                    client = config.conns.get(0) as ConnectionClient;
                }

                const connClient = new ConnectionWebSocket(ws, parsedParams.format, client, auth instanceof AuthUser ? auth.session : undefined);

                let webClients = config.wsClients.get('admin');
                if (!webClients) webClients = [];
                webClients.push(connClient);
                config.wsClients.set('admin', webClients);

                ws.on('close', () => {
                    const conns = config.wsClients.get('admin');
                    if (!conns || !conns.length) return;

                    const i = webClients.indexOf(connClient);
                    if (i < 0) return;
                    webClients[i].destroy();
                    webClients.splice(i, 1);

                    if (webClients.length !== 0) return;

                    config.wsClients.delete('admin');
                });

                if (awaitSecure) await awaitSecure;
                ws.send(JSON.stringify({ type: 'connected' }));
            } else if (auth instanceof AuthUser && parsedParams.connection === auth.email) {
                let client: ConnectionClient | undefined;
                let awaitSecure: Promise<void> | undefined;
                if (!config.conns.has(parsedParams.connection)) {
                    const profile = await config.models.Profile.from(parsedParams.connection);
                    if (!profile.auth.cert || !profile.auth.key) throw new Error('No Cert Found on profile');

                    client = await config.conns.add(new ProfileConnConfig(config, parsedParams.connection, profile.auth));
                    if (client.tak.client && !client.tak.client.authorized) {
                        awaitSecure = new Promise<void>(resolve => (client as ConnectionClient).tak.once('secureConnect', resolve));
                    }
                } else {
                    client = config.conns.get(parsedParams.connection) as ConnectionClient;
                }

                const connClient = new ConnectionWebSocket(ws, parsedParams.format, client, auth.session);

                let webClients = config.wsClients.get(parsedParams.connection);
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
                });

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
                    message: err instanceof Error ? String(err.message) : String(err),
                },
            }));
            await sleep(500);
            ws.close();
        }
    });

    return wss;
}
