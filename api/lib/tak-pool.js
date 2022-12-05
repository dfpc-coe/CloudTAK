import TAK from './tak.js';
import Connection from './types/connection.js';

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 */
export default class TAKPool extends Map {
    /*
     * Page through connections and start a connection for each one
     */
    static async init(pool) {
        const takpool = new TAKPool();

        const conns = [];

        const stream = await Connection.stream(pool);

        return new Promise((resolve, reject) => {
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
    }

    async delete(id) {
        conn.tak.destroy();

        super.delete(id);
    }
}
