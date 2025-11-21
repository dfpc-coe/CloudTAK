import type Config from './config.js';
import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';

export default class ServerManager {
    server: Server;
    wss: WebSocketServer;
    config: Config;

    constructor(
        server: Server,
        wss: WebSocketServer,
        config: Config
    ) {
        this.wss = wss;
        this.server = server;
        this.config = config;
    }

    async close() {
        await Promise.allSettled([
            new Promise((resolve) => {
                this.server.close(resolve);
            }),
            new Promise((resolve) => {
                this.wss.close(resolve);
            }),
            this.config.conns.close()
        ]);


        this.config.pg.end();
    }
}

