import Connection from './types/connection.js';
import Server from './types/server.js';
import Sinks from './sinks.js';
import Config from './config.js';
import Metrics from './aws/metric.js';
// @ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import { WebSocket } from 'ws';
import TAK, { CoT } from '@tak-ps/node-tak';

export class ConnectionWebSocket {
    ws: WebSocket;
    format: string;
    client?: ConnectionClient;

    constructor(ws: WebSocket, format = 'raw', client?: ConnectionClient) {
        this.ws = ws;
        this.format = format;
        if (client) {
            this.client = client;
            this.ws.on('message', (msg) => {
                try {
                    const cot = CoT.from_geojson(JSON.parse(String(msg)));
                    this.client.tak.write([cot]);
                } catch (err) {
                    this.ws.send(JSON.stringify({
                        type: 'Error',
                        properties: {
                            message: err.message
                        }
                    }));
                }
            });
        }
    }
}

class ConnectionClient {
    conn: Connection;
    tak: TAK;
    retry: number;
    initial: boolean;
    ephemeral: boolean;

    constructor(conn: Connection, tak: TAK, ephemeral = false) {
        this.tak = tak;
        this.conn = conn;
        this.retry = 0;
        this.initial = true;
        this.ephemeral = ephemeral;
    }
}

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 */
export default class ConnectionPool extends Map<number | string, ConnectionClient> {
    #server: Server;
    pool: Pool;
    wsClients: Map<string, ConnectionWebSocket[]>;
    metrics: Metrics;
    sinks: Sinks;
    nosinks: boolean;
    stackName: string;
    local: boolean;

    constructor(
        config: Config,
        server: Server,
        wsClients: Map<string, ConnectionWebSocket[]> = new Map(),
        stackName: string,
        local=false
    ) {
        super();
        this.#server = server;
        this.wsClients = wsClients;
        this.stackName = stackName,
        this.local = local,
        this.metrics = new Metrics(stackName);
        if (config.nometrics) this.metrics.paused = true;
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

    status(id: number | string): string {
        if (this.has(id)) {
            return this.get(id).tak.open ? 'live' : 'dead';
        } else {
            return 'unknown';
        }
    }

    /**
     * Handle writing a CoT into the Sink/WebSocket Clients
     * This is also called externally by the layer/:layer/cot API as CoTs
     * aren't rebroadcast to the submitter by the TAK Server
     */
    async cot(conn: Connection, cot: CoT, ephemeral=false) {
        if (this.wsClients.has(String(conn.id))) {
            for (const client of this.wsClients.get(String(conn.id))) {
                if (client.format == 'geojson') {
                    client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: cot.to_geojson() }));
                } else {
                    client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: cot.raw }));
                }
            }
        }

        if (!ephemeral && !this.nosinks && cot.is_atom()) {
            try {
                await this.sinks.cot(conn, cot);
            } catch (err) {
                console.error('Error', err);
            }
        }
    }

    async add(conn: Connection, ephemeral=false): Promise<ConnectionClient> {
        const tak = await TAK.connect(conn.id, new URL(this.#server.url), conn.auth);
        const connClient = new ConnectionClient(conn, tak, ephemeral);
        this.set(conn.id, connClient);

        tak.on('cot', async (cot: CoT) => {
            connClient.retry = 0;
            connClient.initial = false;

            this.cot(conn, cot, ephemeral);
        }).on('end', async () => {
            console.error(`not ok - ${conn.id} @ end`);
            this.retry(connClient);
        }).on('timeout', async () => {
            console.error(`not ok - ${conn.id} @ timeout`);
            this.retry(connClient);
        }).on('ping', async () => {
            if (this.stackName !== 'test' && !ephemeral) {
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

        return connClient;
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

    delete(id: number | string): boolean {
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

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
