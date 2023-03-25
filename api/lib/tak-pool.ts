import TAK from './tak.js';
// @ts-ignore
import Connection from './types/connection.js';
import Metrics from './aws/metric.js';

class TAKPoolClient {
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
 * @param {Server}  server      Server Connection Object
 * @param {Array}   clients     WSS Clients Array
 */
export default class TAKPool extends Map<number, TAKPoolClient> {
    #server: any;
    clients: any[];
    metrics: Metrics;
    stackName: string;

    constructor(server: any, clients: any[] = [], stackName: string) {
        super();
        this.#server = server;
        this.clients = clients;
        this.stackName = stackName,
        this.metrics = new Metrics(stackName);
    }

    async refresh(pool: any, server: any) {
        this.#server = server;

        for (const conn of this.keys()) {
            this.delete(conn);
        }

        await this.init(pool);
    }

    /**
     * Page through connections and start a connection for each one
     *
     * @param {Pool}    pool        Postgres Pol
     */
    async init(pool: any): Promise<void> {
        const conns: any = [];

        const stream = await Connection.stream(pool);

        return new Promise((resolve) => {
            stream.on('data', (conn: any) => {
                if (conn.enabled) {
                    conns.push(async () => {
                        await this.add(conn);
                    });
                }
            }).on('end', async () => {
                for (const conn of conns) {
                    try {
                        await conn();
                    } catch (err) {
                        console.error(err);
                    }
                }

                return resolve();
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
        const pooledClient = new TAKPoolClient(conn, tak);
        this.set(conn.id, pooledClient);

        tak.on('cot', (cot) => {
            pooledClient.retry = 0;
            pooledClient.initial = false;

            for (const client of this.clients) {
                client.send(JSON.stringify({
                    type: 'cot',
                    connection: conn.id,
                    data: cot.raw
                }));
            }
        }).on('end', async () => {
            console.error(`not ok - ${conn.id} @ end`);
            this.retry(pooledClient);
        }).on('timeout', async () => {
            console.error(`not ok - ${conn.id} @ timeout`);
            this.retry(pooledClient);
        }).on('ping', async () => {
            console.error(`ok - ${conn.id} @ ping`);
            //if (this.stackName !== 'test') this.metrics.post(conn.id);
        }).on('error', async (err) => {
            console.error(`not ok - ${conn.id} @ error:${err}`);
            this.retry(pooledClient);
        });
    }

    async retry(pooledClient: TAKPoolClient) {
        if (pooledClient.initial) {
            if (pooledClient.retry >= 5) return; // These are considered stalled connecitons
            pooledClient.retry++
            console.log(`not ok - ${pooledClient.conn.id} - retrying in ${pooledClient.retry * 1000}ms`)
            await sleep(pooledClient.retry * 1000);
            await pooledClient.tak.reconnect();
        } else {
            // For now allow infinite retry if a client has connected once
            const retryms = Math.min(pooledClient.retry * 1000, 15000);
            console.log(`not ok - ${pooledClient.conn.id} - retrying in ${retryms}ms`)
            await sleep(retryms);
            await pooledClient.tak.reconnect();
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
