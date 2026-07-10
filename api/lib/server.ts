import type Config from './config.js';
import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';
import CpuWatchdog from './cpu-watchdog.js';

export default class ServerManager {
    server: Server;
    wss?: WebSocketServer;
    rpc?: Server;
    config: Config;
    watchdog: CpuWatchdog;

    constructor(
        server: Server,
        wss: WebSocketServer | undefined,
        config: Config,
        opts: {
            rpc?: Server;
        } = {},
    ) {
        this.wss = wss;
        this.server = server;
        this.rpc = opts.rpc;
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

        const closing: Promise<unknown>[] = [
            new Promise((resolve) => {
                this.server.closeAllConnections();
                this.server.close(resolve);
            }),
        ];

        if (this.wss) {
            const wss = this.wss;
            closing.push(new Promise((resolve) => {
                wss.close(resolve);
            }));
        }

        if (this.rpc) {
            const rpc = this.rpc;
            closing.push(new Promise((resolve) => {
                rpc.closeAllConnections();
                rpc.close(resolve);
            }));
        }

        if (this.config.mode !== 'api') {
            closing.push(this.config.conns.close());
            closing.push(this.config.geofence.close());
        }

        await Promise.allSettled(closing);

        this.config.pg.end();
    }
}
