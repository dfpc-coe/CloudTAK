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

    constructor(opts: {
        defaultMartiResponses: boolean
    } = {
        defaultMartiResponses: true
    }) {
        if (!opts) opts = {};
        if (opts.defaultMartiResponses === undefined) opts.defaultMartiResponses = true;

        this.keys = {
            cert: '/tmp/cloudtak-test-server.cert',
            key: '/tmp/cloudtak-test-server.key',
        }

        this.mockMarti = [];

        if (opts.defaultMartiResponses) {
            this.mockMartiDefaultResponses();
        }

        CP.execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout ${this.keys.key} -out ${this.keys.cert}`);

        this.streaming = tls.createServer({
            cert: fs.readFileSync(this.keys.cert),
            key: fs.readFileSync(this.keys.key),
            requestCert: true,

            // rejectUnauthorized is set to false to ensure certificate validation is enabled
            rejectUnauthorized: false,
            ca: fs.readFileSync(this.keys.cert)
        }, (request) => {
            console.error('SOCKET TODO');
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

            // rejectUnauthorized is set to false to ensure certificate validation is enabled
            rejectUnauthorized: false,
            ca: fs.readFileSync(this.keys.cert)
        }, async (request, response) => {
            let handled = false;
            for (const handler of this.mockMarti) {
                if (await handler(request, response)) {
                    handled = true;
                    break;
                }
            }

            if (!handled) {
                throw new Error(`Unhandled TAK API Operation: ${request.url}`);
            }
        });

        this.marti.listen(8443, 'localhost', () => {
            console.log('opened MARTI API on', this.marti.address())
        })
    }

    mockMartiDefaultResponses(): void {
         this.mockMarti.push(async (request, response) => {
            console.log(`ok - Mock TAK Request: ${request.method} ${request.url}`);
            if (request.method === 'GET' && request.url === '/files/api/config') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ uploadSizeLimit: 50 }))
                response.end();
                return true;
            } else if (request.method = 'POST' && request.url === '/oauth/token') {
                response.write('fake-oauth-token')
                response.end();
                return true;
            } else {
                return false;
            }
        });
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
