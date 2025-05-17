import CP from 'node:child_process'
import jwt from 'jsonwebtoken';
import tls from 'node:tls'
import https from 'node:https'
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'

export default class MockTAKServer {
    keys: {
        cert: string
        key: string
    };

    streaming: ReturnType<typeof tls.createServer>;
    webtak: ReturnType<typeof http.createServer>;
    marti: ReturnType<typeof https.createServer>;

    mockMarti: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;
    mockWebtak: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;

    constructor(opts: {
        defaultMartiResponses: boolean
    } = {
        defaultMartiResponses: true,
        defaultWebtakResponses: true
    }) {
        if (!opts) opts = {};
        if (opts.defaultMartiResponses === undefined) opts.defaultMartiResponses = true;
        if (opts.defaultWebtakResponses === undefined) opts.defaultWebtakResponses = true;

        this.keys = {
            cert: '/tmp/cloudtak-test-server.cert',
            key: '/tmp/cloudtak-test-server.key',
        }

        this.mockMarti = [];
        this.mockWebtak = [];

        if (opts.defaultMartiResponses) {
            this.mockMartiDefaultResponses();
        }

        if (opts.defaultWebtakResponses) {
            this.mockWebtakDefaultResponses();
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
            console.log(`ok - Mock TAK Request: ${request.method} ${request.url}`);

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

        this.webtak = http.createServer({}, async (request, response) => {
            console.log(`ok - Mock TAK (WebTAK) Request: ${request.method} ${request.url}`);

            let handled = false;
            for (const handler of this.mockWebtak) {
                if (await handler(request, response)) {
                    handled = true;
                    break;
                }
            }

            if (!handled) {
                throw new Error(`Unhandled TAK (WebTAK) API Operation: ${request.url}`);
            }
        });

        this.webtak.listen(8444, 'localhost', () => {
            console.log('opened WEBTAK API on', this.webtak.address())
        })
    }

    mockWebtakDefaultResponses(): void {
         this.mockWebtak.push(async (request, response) => {
            if (request.method === 'POST' && request.url.startsWith('/oauth/token')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ access_token: jwt.sign({}, 'fake-test-token') }))
                response.end();
                return true;
            } else {
                return false;
            }
        });
    }

    mockMartiDefaultResponses(): void {
         this.mockMarti.push(async (request, response) => {
            if (request.method === 'GET' && request.url === '/files/api/config') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ uploadSizeLimit: 50 }))
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
                this.webtak.close(() => {
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
