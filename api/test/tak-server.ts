import CP from 'node:child_process'
import jwt from 'jsonwebtoken';
import tls from 'node:tls'
import https from 'node:https'
import http from 'node:http'
import stream2buffer from '../lib/stream.js';
import crypto from 'node:crypto';
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

    sockets: Set<tls.TLSSocket | import('net').Socket>

    defaultMartiResponses: boolean;
    defaultWebtakResponses: boolean;

    mockMarti: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;
    mockWebtak: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;

    constructor(opts: {
        defaultMartiResponses?: boolean,
        defaultWebtakResponses?: boolean
    } = {
        defaultMartiResponses: true,
        defaultWebtakResponses: true
    }) {
        if (!opts) opts = {};
        if (opts.defaultMartiResponses === undefined) opts.defaultMartiResponses = true;
        if (opts.defaultWebtakResponses === undefined) opts.defaultWebtakResponses = true;

        this.defaultMartiResponses = opts.defaultMartiResponses;
        this.defaultWebtakResponses = opts.defaultWebtakResponses;

        this.keys = {
            cert: '/tmp/cloudtak-test-server.cert',
            key: '/tmp/cloudtak-test-server.key',
        }

        this.mockMarti = [];
        this.mockWebtak = [];

        this.sockets = new Set();

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
            rejectUnauthorized: true,
            ca: fs.readFileSync(this.keys.cert)
        }, (socket) => {
            this.sockets.add(socket);
            socket.on('close', () => this.sockets.delete(socket));
        });

        this.streaming.on('error', (e) => {
            console.error('Server Error', e);
        });

        this.marti = https.createServer({
            cert: fs.readFileSync(this.keys.cert),
            key: fs.readFileSync(this.keys.key),
            requestCert: true,
            rejectUnauthorized: true,
            ca: fs.readFileSync(this.keys.cert)
        }, async (request, response) => {
            console.log(`ok - Mock TAK Request: ${request.method} ${request.url}`);

            try {
                let handled = false;
                for (const handler of this.mockMarti) {
                    if (await handler(request, response)) {
                        handled = true;
                        break;
                    }
                }

                if (!handled) {
                    throw new Error(`Unhandled TAK API Operation: ${request.method} ${request.url}`);
                }
            } catch (err) {
                console.error(err);
                if (!response.headersSent) {
                    response.statusCode = 500;
                    response.end();
                }
            }
        });

        this.marti.on('secureConnection', (socket) => {
            this.sockets.add(socket);
            socket.on('close', () => this.sockets.delete(socket));
        });

        this.webtak = http.createServer({}, async (request, response) => {
            console.log(`ok - Mock TAK (WebTAK) Request: ${request.method} ${request.url || ''}`);

            try {
                let handled = false;
                for (const handler of this.mockWebtak) {
                    if (await handler(request, response)) {
                        handled = true;
                        break;
                    }
                }

                if (!handled) {
                    throw new Error(`Unhandled TAK (WebTAK) API Operation: ${request.method} ${request.url}`);
                }
            } catch (err) {
                console.error(err);
                if (!response.headersSent) {
                    response.statusCode = 500;
                    response.end();
                }
            }
        });

        this.webtak.on('connection', (socket) => {
            this.sockets.add(socket);
            socket.on('close', () => this.sockets.delete(socket));
        });
    }

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            let started = 0;
            const check = () => {
                if (++started === 3) resolve();
            }

            this.streaming.once('error', reject);
            this.streaming.listen(8089, 'localhost', () => {
                console.log('opened TCP streaming on', this.streaming.address());
                this.streaming.removeListener('error', reject);
                check();
            });

            this.marti.once('error', reject);
            this.marti.listen(8443, 'localhost', () => {
                console.log('opened MARTI API on', this.marti.address());
                this.marti.removeListener('error', reject);
                check();
            });

            this.webtak.once('error', reject);
            this.webtak.listen(8444, 'localhost', () => {
                console.log('opened WEBTAK API on', this.webtak.address());
                this.webtak.removeListener('error', reject);
                check();
            });
        });
    }

    mockWebtakDefaultResponses(): void {
         this.mockWebtak = [(async (request, response) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'POST' && request.url.startsWith('/oauth/token')) {
                const url = new URL(request.url, 'http://localhost');
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ access_token: jwt.sign({
                    sub: url.searchParams.get('username')
                }, 'fake-test-token') }))
                response.end();
                return true;
            } else if (request.method === 'GET' && request.url === '/Marti/api/tls/config') {
                response.setHeader('Content-Type', 'text/xml');
                response.write('<ns2:certificateConfig><nameEntries><nameEntry O="test"/><nameEntry OU="test"/></nameEntries></ns2:certificateConfig>')
                response.end();
                return true;
            } else if (request.method === 'POST' && request.url.startsWith('/Marti/api/tls/signClient/v2')) {
                const csr = crypto.randomUUID();
                fs.writeFileSync(`/tmp/${csr}.csr`, String(await stream2buffer(request)));

                CP.execSync(`openssl x509 -req -in /tmp/${csr}.csr -CA ${this.keys.cert} -CAkey ${this.keys.key} -CAcreateserial -out /tmp/${csr}.pem -days 365 -sha256`)

                const signedCertArr = String(fs.readFileSync(`/tmp/${csr}.pem`))
                    .split('\n')
                    .filter((line) => { return line.length });

                const signedCert = signedCertArr.slice(1, signedCertArr.length - 1)
                    .join('\n')

                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ signedCert: signedCert }))
                response.end();
                return true;
            } else {
                return false;
            }
        })];
    }

    mockMartiDefaultResponses(): void {
         this.mockMarti = [(async (request, response) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url === '/files/api/config') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ uploadSizeLimit: 50 }))
                response.end();
                return true;
            } else if (request.method === 'GET' && request.url === '/Marti/api/contacts/all') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify([]))
                response.end();
                return true;
            } else {
                return false;
            }
        })];
    }

    reset(): void {
        if (this.defaultMartiResponses) {
            this.mockMartiDefaultResponses();
        } else {
            this.mockMarti = [];
        }

        if (this.defaultWebtakResponses) {
            this.mockWebtakDefaultResponses();
        } else {
            this.mockWebtak = []
        }
    }

    async close(): Promise<void> {
        for (const socket of this.sockets.values()) {
            socket.destroy();
        }
        this.sockets.clear();

        await Promise.all([
            new Promise<void>((resolve) => {
                if ('closeAllConnections' in this.streaming) (this.streaming as any).closeAllConnections();
                this.streaming.close(() => {
                    return resolve();
                });
            }),
            new Promise<void>((resolve) => {
                if ('closeAllConnections' in this.webtak) (this.webtak as any).closeAllConnections();
                this.webtak.close(() => {
                    return resolve();
                });
            }),
            new Promise<void>((resolve) => {
                if ('closeAllConnections' in this.marti) (this.marti as any).closeAllConnections();
                this.marti.close(() => {
                    return resolve();
                });
            })
        ])
    }
}
