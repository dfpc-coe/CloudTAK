import type Config from './config.js';
import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';
import CpuWatchdog from './cpu-watchdog.js';

export default class ServerManager {
    server: Server;
    wss: WebSocketServer;
    config: Config;
    watchdog: CpuWatchdog;

    constructor(
        server: Server,
        wss: WebSocketServer,
        config: Config,
    ) {
        this.wss = wss;
        this.server = server;
        this.config = config;

        this.watchdog = new CpuWatchdog(config);

        // The watchdog uploads profiles to the asset bucket, which isn't
        // available in the test harness, so only run it outside of tests.
        if (config.StackName !== 'test') {
            this.watchdog.start();
        }
    }

    async close() {
        this.watchdog.stop();

        await Promise.allSettled([
            new Promise((resolve) => {
                this.server.closeAllConnections();
                this.server.close(resolve);
            }),
            new Promise((resolve) => {
                this.wss.close(resolve);
            }),
            this.config.conns.close(),
            this.config.geofence.close(),
        ]);

        this.config.pg.end();
    }
}
