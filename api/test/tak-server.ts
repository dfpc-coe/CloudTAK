import CP from 'node:child_process'
import tls from 'node:tls'
import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'

export default class MockTAKServer {
    keys: {
        cert: string
        key: string
    };

    streaming: ReturnType<typeof tls.createServer>;
    marti: ReturnType<typeof https.createServer>;

    mockMarti: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;

    constructor() {
        this.keys = {
            cert: '/tmp/cloudtak-test-server.cert',
            key: '/tmp/cloudtak-test-server.key',
        }

        this.mockMarti = [];

        CP.execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout ${this.keys.key} -out ${this.keys.cert}`);

        this.streaming = tls.createServer({
            cert: fs.readFileSync(this.keys.cert),
            key: fs.readFileSync(this.keys.key),
            requestCert: true,
            rejectUnauthorized: false,
            ca: fs.readFileSync(this.keys.cert)
        }, (request) => {
            console.error('SOCKET');
        });

        this.streaming.on('error', (e) => {
            console.error('Server Error', e);
        });

        this.streaming.listen(8089, 'localhost', () => {
            console.log('opened TCP streaming on', this.streaming.address())
        })

        this.marti = https.createServer({
            cert: fs.readFileSync(this.keys.cert),
            key: fs.readFileSync(this.keys.key),
            requestCert: true,
            rejectUnauthorized: false,
            ca: fs.readFileSync(this.keys.cert)
        }, async (request, response) => {
            for (const handler of this.mockMarti) {
                if (await this.handler(request, response)) break;
            }

            throw new Error(`Unhandled TAK API Operation: ${request.url}`);
        });

        this.marti.listen(8443, 'localhost', () => {
            console.log('opened MARTI API on', this.marti.address())
        })
    }

    async close(): Promise<void> {
        await Promise.all([
            new Promise<void>((resolve) => {
                this.streaming.close(() => {
                    return resolve();
                });
            }),
            new Promise<void>((resolve) => {
                this.marti.close(() => {
                    return resolve();
                });
            })
        ])
    }
}
