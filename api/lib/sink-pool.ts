import TAK from './tak.js';
// @ts-ignore
import Connection from './types/connection.js';
// @ts-ignore
import ConnectionSink from './types/connection-sink.js';
// @ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import SinkPool from './sink-pool.js';
import { WebSocket } from 'ws';

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 *
 * @param server      Server Connection Object
 * @param clients     WSS Clients Array
 */
export default class TAKPool extends Map<number, ConnectionSink> {
    local: boolean;

    constructor(local=false) {
        super();
        this.local = local,
    }

    async refresh(pool: Pool) {
        for (const sink of this.keys()) {
            this.delete(sink);
        }

        await this.init(pool);
    }

    /**
     * Page through sinks and populate the map
     *
     * @param pool        Postgres Pool
     */
    async init(pool: Pool): Promise<void> {
        const sinks: ConnectionSink[] = [];

        const stream = await ConnectionSink.stream(pool);

        return new Promise((resolve) => {
            stream.on('data', (sink: ConnectionSink) => {
                if (conn.enabled && !this.local) {
                    sinks.push(this.add(sink))
                }
            }).on('end', async () => {
                try {
                    await Promise.all(sinks);
                    return resolve();
                } catch (err) {
                    return reject(err);
                }
            });
        });
    }

    async add(sink: ConnectionSink) {
        const tak = await TAK.connect(conn.id, new URL(this.#server.url), conn.auth);
        const pooledClient = new TAKPoolClient(conn, sinks, tak);
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
            if (this.stackName !== 'test') {
                try {
                    await this.metrics.post(conn.id);
                } catch (err) {
                    console.error(`not ok - failed to push metrics - ${err}`);
                }
            }
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
