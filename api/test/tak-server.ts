import { MockAgent, setGlobalDispatcher } from 'undici';
import CP from 'node:child_process'
import tls from 'node:tls'
import fs from 'node:fs'

export default class MockTAKServer {
    keys: {
        cert: string
        key: string
    };

    server: ReturnType<typeof tls.createServer>;
    sockets: Set<tls.TLSSocket>;
    mockAgent: MockAgent;

    constructor() {
        this.keys = {
            cert: '/tmp/cloudtak-test-server.cert',
            key: '/tmp/cloudtak-test-server.key',
        }

        this.sockets = new Set();

        CP.execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout ${this.keys.key} -out ${this.keys.cert}`);

        this.server = tls.createServer({
            cert: fs.readFileSync(this.keys.cert),
            key: fs.readFileSync(this.keys.key),
            requestCert: true,
            rejectUnauthorized: false,
            ca: fs.readFileSync(this.keys.cert)
        }, (socket) => {
            this.sockets.add(socket)
            console.error('ok - MockTAK Connection');
        });

        this.server.on('error', (e) => {
            console.error('Server Error', e);
        });

        this.server.listen(8089, 'localhost', () => {
            console.log('opened TCP server on', this.server.address())
        })

        this.mockAgent = new MockAgent()
        //setGlobalDispatcher(this.mockAgent);

        //const mockPool = this.mockAgent.get(/.*localhost:8443.*/);

        //mockPool.intercept({
        //    path: /.*/
        //}).reply((req) => {
        //    console.error('TAK API', req);
        //});
    }

    async close() {
        await this.mockAgent.close();

        return new Promise((resolve) => {
            this.server.close(() => {
                return resolve();
            });

            for (const socket of this.sockets.values()) {
                socket.destroy();
            }
        })
    }
}
