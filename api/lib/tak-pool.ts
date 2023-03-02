import TAK from './tak.js';
// @ts-ignore
import Connection from './types/connection.js';

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 *
 * @param {Server}  server      Server Connection Object
 * @param {Array}   clients     WSS Clients Array
 */
export default class TAKPool extends Map {
    server: any;
    clients: any[];

    constructor(server: any, clients: any[] = []) {
        super();
        this.server = server;
        this.clients = clients;
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
                conns.push(async () => {
                    await this.add(conn);
                });
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

    async add(conn: any) {
        const tak = await TAK.connect(new URL(this.server.url), conn.auth);
        this.set(conn.id, { conn, tak });

        tak.on('cot', (cot) => {
            for (const client of this.clients) {
                client.send(JSON.stringify({
                    type: 'cot',
                    connection: conn.id,
                    data: cot.raw
                }));
            }
        }).on('close', async () => {
            console.error(`not ok - ${conn.id}@close`);
            await tak.reconnect();
        }).on('timeout', async () => {
            console.error(`not ok - ${conn.id}@timeout`);
            await tak.reconnect();
        }).on('error', async (err) => {
            console.error(`not ok - ${conn.id}:@error:${err}`);
            await tak.reconnect();
        });
    }

    delete(id: number): boolean {
        if (this.has(id)) {
            const conn = this.get(id);
            conn.tak.destroy();
            this.delete(id);

            return true;
        } else {
            return false;
        }
    }
}
