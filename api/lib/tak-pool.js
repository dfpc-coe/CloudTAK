import TAK from './tak.js';
import Connection from './types/connection.js';

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 *
 * @param {Server}  server      Server Connection Object
 * @param {Array}   clients     WSS Clients Array
 */
export default class TAKPool extends Map {
    constructor(server, clients = []) {
        super();
        this.server = server;
        this.clients = clients;
    }

    /**
     * Page through connections and start a connection for each one
     *
     * @param {Pool}    pool        Postgres Pol
     */
    async init(pool) {
        const conns = [];

        const stream = await Connection.stream(pool);

        return new Promise((resolve) => {
            stream.on('data', (conn) => {
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

    status(conn) {
        if (this.has(conn.id)) {
            return this.get(conn.id).tak.open ? 'live' : 'dead';
        } else {
            return 'unknown';
        }
    }

    async add(conn) {
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

    delete(id) {
        this.get(id).tak.destroy();
        this.delete(id);
    }
}
