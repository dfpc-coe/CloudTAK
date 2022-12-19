import TAK from './tak.js';
import Connection from './types/connection.js';

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 *
 * @param {Array}   clients     WSS Clients Array
 */
export default class TAKPool extends Map {
    constructor(clients = []) {
        super();
        this.clients = clients;
    }

    /**
     * Page through connections and start a connection for each one
     *
     * @param {Pool}    pool        Postgres Pol
     * @param {Array}   clients     WSS Clients Array
     */
    static async init(pool, clients = []) {
        const takpool = new TAKPool(clients);

        const conns = [];

        const stream = await Connection.stream(pool);

        return new Promise((resolve) => {
            stream.on('data', (conn) => {
                conns.push(async () => {
                    await takpool.add(conn);
                });
            }).on('end', async () => {
                for (const conn of conns) await conn();
                return resolve(takpool);
            });
        });
    }

    async add(conn) {
        const tak = await TAK.connect(new URL(process.env.TAK_SERVER), conn.auth);
        this.set(conn.id, { conn, tak });

        tak.on('cot', (cot) => {
            for (const client of this.clients) {
                client.send(JSON.stringify({
                    type: 'cot',
                    connection: conn.id,
                    data: cot.raw
                }));
            }
        }).on('error', (err) => {
            console.error('ERROR', err, conn.id);
        });
    }

    delete(id) {
        this.get(id).tak.destroy();
        this.delete(id);
    }
}
