import type Config from './config.js';
import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';

export default class ServerManager {
    server: Server;
    websocketServer?: Server;
    wss: WebSocketServer;
    config: Config;

    constructor(
        server: Server,
        wss: WebSocketServer,
        config: Config,
        websocketServer?: Server
    ) {
        this.wss = wss;
        this.server = server;
        this.config = config;
        this.websocketServer = websocketServer;
    }

    async close() {
        await Promise.allSettled([
            new Promise((resolve) => {
                this.server.closeAllConnections();
                this.server.close(resolve);
            }),
            new Promise((resolve) => {
                if (!this.websocketServer) return resolve(undefined);

                this.websocketServer.closeAllConnections();
                this.websocketServer.close(resolve);
            }),
            new Promise((resolve) => {
                this.wss.close(resolve);
            }),
            this.config.conns.close(),
            this.config.geofence.close()
        ]);


        this.config.pg.end();
    }
}

