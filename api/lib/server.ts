import type Config from './config.js';
import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';

export default class ServerManager {
    server: Server;
    wss?: WebSocketServer;
    config: Config;

    constructor(
        server: Server,
        config: Config,
        wss?: WebSocketServer,
    ) {
        this.wss = wss;
        this.server = server;
        this.config = config;
    }

    async close() {
        await Promise.allSettled([
            new Promise((resolve) => {
                this.server.closeAllConnections();
                this.server.close(resolve);
            }),
            new Promise((resolve) => {
                if (this.wss) {
                    this.wss.close(resolve);
                } else {
                    resolve(undefined);
                }
            }),
            this.config.conns.close(),
            this.config.geofence.close(),
        ]);

        this.config.pg.end();
    }
}
