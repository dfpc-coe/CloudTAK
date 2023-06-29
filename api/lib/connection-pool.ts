import TAK from './tak.js';
// @ts-ignore
import Connection from './types/connection.js';
// @ts-ignore
import ConnectionSink from './types/connection-sink.js';
// @ts-ignore
import Server from './types/server.js';
import Sinks from './sinks.js';
import Config from './config.js';
import Metrics from './aws/metric.js';
// @ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import { WebSocket } from 'ws';
import { XML as COT } from '@tak-ps/node-cot';

class ConnectionClient {
    conn: Connection;
    tak: TAK;
    retry: number;
    initial: boolean;

    constructor(conn: Connection, tak: TAK) {
        this.tak = tak;
        this.conn = conn;
        this.retry = 0;
        this.initial = true;
    }
}

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 *
 * @param server      Server Connection Object
 * @param clients     WSS Clients Array
 */
export default class ConnectionPool extends Map<number, ConnectionClient> {
    #server: Server;
    pool: Pool;
    clients: WebSocket[];
    metrics: Metrics;
    sinks: Sinks;
    nosinks: boolean;
    stackName: string;
    local: boolean;

    constructor(config: Config, server: Server, clients: WebSocket[] = [], stackName: string, local=false) {
        super();
        this.#server = server;
        this.clients = clients;
        this.stackName = stackName,
        this.local = local,
        this.metrics = new Metrics(stackName);
        this.pool = config.pool;
        this.sinks = new Sinks(config);
        this.nosinks = config.nosinks;
    }

    async refresh(pool: Pool, server: Server) {
        this.#server = server;

        for (const conn of this.keys()) {
            this.delete(conn);
        }

        await this.init();
    }

    /**
     * Page through connections and start a connection for each one
     */
    async init(): Promise<void> {
        const conns: Connection[] = [];

        const stream = await Connection.stream(this.pool);

        return new Promise((resolve, reject) => {
            stream.on('data', (conn: Connection) => {
                if (conn.enabled && !this.local) {
                    conns.push(this.add(conn));
                }
            }).on('end', async () => {
                try {
                    await Promise.all(conns);
                    return resolve();
                } catch (err) {
                    console.error(err);
                    return reject(err);
                }

            });
        });
    }

    status(id: number): string {
        if (this.has(id)) {
            return this.get(id).tak.open ? 'live' : 'dead';
        } else {
            return 'unknown';
        }
    }

    async add(conn: Connection) {
        const tak = await TAK.connect(conn.id, new URL(this.#server.url), conn.auth);
        const connClient = new ConnectionClient(conn, tak);
        this.set(conn.id, connClient);

        tak.on('cot', async (cot: COT) => {
            connClient.retry = 0;
            connClient.initial = false;

            for (const client of this.clients) {
                client.send(JSON.stringify({
                    type: 'cot',
                    connection: conn.id,
                    data: cot.raw
                }));
            }

            if (!this.nosinks) {
                await this.sinks.cot(conn, cot);
            }
        }).on('end', async () => {
            console.error(`not ok - ${conn.id} @ end`);
            this.retry(connClient);
        }).on('timeout', async () => {
            console.error(`not ok - ${conn.id} @ timeout`);
            this.retry(connClient);
        }).on('ping', async () => {
            if (this.stackName !== 'test') {
                try {
                    await this.metrics.post(conn.id);
                } catch (err) {
                    console.error(`not ok - failed to push metrics - ${err}`);
                }
            }
        }).on('error', async (err) => {
            console.error(`not ok - ${conn.id} @ error:${err}`);
            this.retry(connClient);
        });
    }

    async retry(connClient: ConnectionClient) {
        if (connClient.initial) {
            if (connClient.retry >= 5) return; // These are considered stalled connecitons
            connClient.retry++
            console.log(`not ok - ${connClient.conn.id} - retrying in ${connClient.retry * 1000}ms`)
            await sleep(connClient.retry * 1000);
            await connClient.tak.reconnect();
        } else {
            // For now allow infinite retry if a client has connected once
            const retryms = Math.min(connClient.retry * 1000, 15000);
            console.log(`not ok - ${connClient.conn.id} - retrying in ${retryms}ms`)
            await sleep(retryms);
            await connClient.tak.reconnect();
        }
    }

    delete(id: number): boolean {
        if (this.has(id)) {
            const conn = this.get(id);
            conn.tak.destroy();
            super.delete(id);

            return true;
        } else {
            return false;
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
