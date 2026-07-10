import express from 'express';
import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type WebSocket from 'ws';
import * as ws from 'ws';
import { ProfileConnConfig, AdminConnConfig } from '../connection-config.js';
import { ConnectionClient } from '../connection-pool.js';
import { ConnectionWebSocket } from '../connection-web.js';
import sleep from '../sleep.js';
import hubRouter from '../hub/routes.js';
import { tokenParser, AuthUser } from '../auth.js';
import type Config from '../config.js';

/**
 * Attach the web-client WebSocket server (upgrade auth + connection
 * handler) to an HTTP server - hosted by the stateful server
 */
export function attachWebsocket(srv: Server, config: Config): ws.WebSocketServer {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WebSocketServer = ws.WebSocketServer ?? (ws as any).default.WebSocketServer;

    const wss = new WebSocketServer({
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

    srv.on('upgrade', async (request, socket, head) => {
        // A socket dropped during the async auth check would otherwise
        // surface as an unhandled 'error' event and crash the process
        socket.on('error', () => socket.destroy());

        // Reject a dead session with an HTTP 401 during the handshake -
        // an accepted socket fires the client's `open` handler and kicks
        // off a full sync before the auth error ever reaches it
        try {
            const params = new URLSearchParams((request.url || '').replace(/.*\?/, ''));
            const token = params.get('token');
            if (!token) throw new Error('Token Parameter Required');

            await tokenParser(config, token, config.SigningSecret);
        } catch (err) {
            if (err instanceof Error && !err.message.includes('jwt expired')) {
                console.error('Error: WebSocket Upgrade: ', err);
            }

            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
            wss.emit('connection', ws, request);
        });
    });

    return wss;
}

/**
 * Start the internal RPC server through which stateless API instances
 * interact with the hub's stateful resources. Listens on a dedicated port
 * that is only ever exposed to the API service - never the public ALB
 */
export function startHubRpc(config: Config): Promise<Server> {
    const app = express();

    app.disable('x-powered-by');

    // Load balancer health check - no auth (the ALB can't sign a JWT)
    app.get('/hub', (req, res) => {
        res.json({ status: 200, message: 'CloudTAK Hub' });
    });

    app.use('/hub', hubRouter(config));

    return new Promise((resolve) => {
        const srv = app.listen(parseInt(process.env.HUB_RPC_PORT || '5002'), () => {
            if (!config.silent) {
                const address = srv.address();
                const port = address && typeof address === 'object' ? address.port : process.env.HUB_RPC_PORT || '5002';
                console.log(`ok - hub rpc - http://localhost:${port}`);
            }

            resolve(srv);
        });
    });
}
