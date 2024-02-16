import Err from '@openaddresses/batch-error';
import Sinks from './sinks.js';
import Config from './config.js';
import Metrics from './aws/metric.js';
import TAK, { CoT } from '@tak-ps/node-tak';
import Modeler from '@openaddresses/batch-generic';
import { Connection } from './schema.js';
import { InferSelectModel } from 'drizzle-orm';
import sleep from './sleep.js';
import ConnectionConfig from './connection-config.js';

export class ConnectionClient {
    config: ConnectionConfig;
    tak: TAK;
    retry: number;
    initial: boolean;
    ephemeral: boolean;

    constructor(
        config: ConnectionConfig,
        tak: TAK,
        ephemeral = false
    ) {
        this.tak = tak;
        this.config = config;
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
    config: Config;
    metrics: Metrics;
    sinks: Sinks;

    constructor(config: Config) {
        super();

        this.config = config;
        this.metrics = new Metrics(this.config.StackName);

        if (config.nometrics) this.metrics.paused = true;
        this.sinks = new Sinks(config);
    }

    async refresh() {
        for (const conn of this.keys()) {
            this.delete(conn);
        }

        await this.init();
    }

    /**
     * Page through connections and start a connection for each one
     */
    async init(): Promise<void> {
        const conns: Promise<ConnectionClient>[] = [];

        const ConnectionModel = new Modeler(this.config.pg, Connection);
        const stream = ConnectionModel.stream();

        return new Promise((resolve, reject) => {
            stream.on('data', async (conn: InferSelectModel<typeof Connection>) => {
                if (conn.enabled && !this.config.local) {
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
        const conn = this.get(id);

        if (conn) {
            return conn.tak.open ? 'live' : 'dead';
        } else {
            return 'unknown';
        }
    }

    /**
     * Handle writing a CoT into the Sink/WebSocket Clients
     * This is also called externally by the layer/:layer/cot API as CoTs
     * aren't rebroadcast to the submitter by the TAK Server
     */
    async cot(conn: ConnectionConfig, cot: CoT, ephemeral=false) {
        if (this.config.wsClients.has(String(conn.id))) {
            for (const client of (this.config.wsClients.get(String(conn.id)) || [])) {
                if (client.format == 'geojson') {
                    const feat = cot.to_geojson();

                    if (feat.properties && feat.properties.chat) {
                        client.ws.send(JSON.stringify({ type: 'chat', connection: conn.id, data: feat }));
                    } else {
                        client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: feat }));
                    }
                } else {
                    client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: cot.raw }));
                }
            }
        }

        if (!ephemeral && !this.config.nosinks && cot.is_atom()) {
            const c = conn as InferSelectModel<typeof Connection>;
            try {
                await this.sinks.cot(c, cot);
            } catch (err) {
                console.error('Error', err);
            }
        }
    }

    async add(conn: ConnectionConfig, ephemeral=false): Promise<ConnectionClient> {
        if (!conn.auth || !conn.auth.cert || !conn.auth.key) throw new Err(400, null, 'Connection must have auth.cert & auth.key');
        const tak = await TAK.connect(conn.id, new URL(this.config.server.url), {
            key: conn.auth.key,
            cert: conn.auth.cert
        });
        const connClient = new ConnectionClient(conn, tak, ephemeral);

        this.set(conn.id, connClient);

        tak.on('cot', async (cot: CoT) => {
            connClient.retry = 0;
            connClient.initial = false;

            this.cot(conn, cot, ephemeral);
        }).on('end', async () => {
            console.error(`not ok - ${conn.id} - ${conn.name} @ end`);
            this.retry(connClient);
        }).on('timeout', async () => {
            console.error(`not ok - ${conn.id} - ${conn.name} @ timeout`);
            this.retry(connClient);
        }).on('ping', async () => {
            if (this.config.StackName !== 'test' && !ephemeral) {
                try {
                    const c = conn as InferSelectModel<typeof Connection>;
                    await this.metrics.post(c.id);
                } catch (err) {
                    console.error(`not ok - failed to push metrics - ${err}`);
                }
            }
        }).on('error', async (err) => {
            console.error(`not ok - ${conn.id} - ${conn.name} @ error:${err}`);
            this.retry(connClient);
        });

        return connClient;
    }

    async retry(connClient: ConnectionClient) {
        if (connClient.initial) {
            if (connClient.retry >= 5) return; // These are considered stalled connections
            connClient.retry++
            console.log(`not ok - ${connClient.config.id} - ${connClient.config.name} - retrying in ${connClient.retry * 1000}ms`)
            await sleep(connClient.retry * 1000);
            await connClient.tak.reconnect();
        } else {
            // For now allow infinite retry if a client has connected once
            const retryms = Math.min(connClient.retry * 1000, 15000);
            console.log(`not ok - ${connClient.config.id} - ${connClient.config.name} - retrying in ${retryms}ms`)
            await sleep(retryms);
            await connClient.tak.reconnect();
        }
    }

    delete(id: number | string): boolean {
        const conn = this.get(id);

        if (conn) {
            conn.tak.destroy();
            super.delete(id);

            return true;
        } else {
            return false;
        }
    }
}
