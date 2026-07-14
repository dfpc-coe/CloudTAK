import type Config from './config.js';
import type ConfigStateful from '../stateful/config.js';
import type ConfigStateless from '../stateless/config.js';
import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';
import CpuWatchdog from './cpu-watchdog.js';

export default class ServerManager {
    server: Server;
    wss?: WebSocketServer;
    rpc?: Server;
    config: Config;
    stateful?: ConfigStateful;
    stateless?: ConfigStateless;
    watchdog: CpuWatchdog;

    constructor(
        server: Server,
        wss: WebSocketServer | undefined,
        configs: {
            stateful?: ConfigStateful;
            stateless?: ConfigStateless;
        },
        opts: {
            rpc?: Server;
        } = {},
    ) {
        this.wss = wss;
        this.server = server;
        this.rpc = opts.rpc;
        this.stateful = configs.stateful;
        this.stateless = configs.stateless;

        const primary = configs.stateless || configs.stateful;
        if (!primary) throw new Error('ServerManager requires a stateful and/or stateless Config');
        this.config = primary;

        this.watchdog = new CpuWatchdog(this.config);

        // The watchdog uploads profiles to the asset bucket, which isn't
        // available in the test harness, so only run it outside of tests.
        if (this.config.StackName !== 'test') {
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

        if (this.stateful) {
            closing.push(this.stateful.conns.close());
            closing.push(this.stateful.geofence.close());
        }

        await Promise.allSettled(closing);

        // The stateful and stateless configs each own a database pool
        this.stateful?.pg.end();
        this.stateless?.pg.end();
    }
}
