import CP from 'node:child_process'
import jwt from 'jsonwebtoken';
import tls from 'node:tls'
import https from 'node:https'
import http from 'node:http'
import type CoT from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';
import stream2buffer from '../lib/stream.js';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'

/**
 * Mocking Framework for CloudTAK <=> TAK Server API Interactions
 */
export default class MockTAKServer {
    keys: {
        cert: string
        key: string
    };

    streaming: ReturnType<typeof tls.createServer>;
    webtak: ReturnType<typeof http.createServer>;
    marti: ReturnType<typeof https.createServer>;

    /** All sockets across all three servers (streaming + HTTP) */
    sockets: Set<tls.TLSSocket | import('net').Socket>;

    /** Only the TLS sockets connected to the TAK streaming port (8089) */
    streamingSockets: Set<tls.TLSSocket>

    defaultMartiResponses: boolean;
    defaultWebtakResponses: boolean;

    mockMarti: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;
    mockWebtak: Array<(request: IncomingMessage, response: ServerResponse) => Promise<boolean>>;

    /** Log of all incoming Marti API requests for test assertions */
    martiRequests: Array<string>;

    /** Log of Marti requests that had no matching handler */
    unhandledMartiRequests: Array<string>;

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
        this.martiRequests = [];
        this.unhandledMartiRequests = [];

        this.sockets = new Set();
        this.streamingSockets = new Set();

        if (opts.defaultMartiResponses) {
            this.mockMartiDefaultResponses();
        }

        if (opts.defaultWebtakResponses) {
            this.mockWebtakDefaultResponses();
        }

        CP.execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout ${this.keys.key} -out ${this.keys.cert} 2> /dev/null`);

        this.streaming = tls.createServer({
            cert: fs.readFileSync(this.keys.cert),
            key: fs.readFileSync(this.keys.key),
            requestCert: true,
            rejectUnauthorized: true,
            ca: fs.readFileSync(this.keys.cert)
        }, (socket) => {
            this.sockets.add(socket);
            this.streamingSockets.add(socket);
            socket.on('close', () => {
                this.sockets.delete(socket);
                this.streamingSockets.delete(socket);
            });
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
            this.martiRequests.push(`${request.method} ${request.url}`);

            try {
                let handled = false;
                for (const handler of this.mockMarti) {
                    if (await handler(request, response)) {
                        handled = true;
                        break;
                    }
                }

                if (!handled) {
                    this.unhandledMartiRequests.push(`${request.method} ${request.url}`);
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

        this.marti.on('connection', (socket) => {
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
        await Promise.all([
            this.listen(this.streaming, 8089, 'TCP streaming'),
            this.listen(this.marti, 8443, 'MARTI API'),
            this.listen(this.webtak, 8444, 'WEBTAK API')
        ]);
    }

    async listen(server: any, port: number, name: string, retries = 5): Promise<void> {
        for (let i = 0; i < retries; i++) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const onError = (e: any) => {
                        server.removeListener('listening', onListening);
                        reject(e);
                    };
                    const onListening = () => {
                        server.removeListener('error', onError);
                        resolve();
                    };

                    server.once('error', onError);
                    server.once('listening', onListening);
                    server.listen(port, '127.0.0.1');
                });
                return;
            } catch (err: any) {
                if (err.code === 'EADDRINUSE') {
                    if (i < retries - 1) {
                        console.log(`Port ${port} in use, retrying (${i + 1}/${retries})...`);
                        await new Promise(r => setTimeout(r, 1000));
                        try {
                            server.close();
                        } catch (e) {
                            console.error('Error closing server:', e);
                        }
                        continue;
                    }
                }
                throw err;
            }
        }
        throw new Error(`Failed to bind port ${port} after ${retries} retries`);
    }

    mockWebtakDefaultResponses(): void {
         this.mockWebtak = [(async (request, response) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'POST' && request.url.startsWith('/oauth/token')) {
                const body = (await stream2buffer(request)).toString();
                const params = new URLSearchParams(body);
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ access_token: jwt.sign({
                    sub: params.get('username')
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

                CP.execSync(`openssl x509 -req -in /tmp/${csr}.csr -CA ${this.keys.cert} -CAkey ${this.keys.key} -CAcreateserial -out /tmp/${csr}.pem -days 365 -sha256 2> /dev/null`)

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
            } else if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=false') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({ version: '3', type: 'com.bbn.marti.remote.groups.Group', data: [] }))
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

        this.martiRequests = [];
        this.unhandledMartiRequests = [];
    }

    write(cot: CoT): void {
        for (const socket of this.sockets) {
            socket.write(CoTParser.to_xml(cot));
        }
    }

    /**
     * Write a raw XML string only to the TAK streaming (TLS port 8089) sockets.
     * Use this to inject CoT messages directly into the TAK data stream without
     * affecting the Marti/WebTAK HTTP servers.
     */
    streamingWrite(xml: string): void {
        for (const socket of this.streamingSockets) {
            socket.write(xml);
        }
    }

    /**
     * Abruptly destroy every active TAK streaming TLS socket, simulating the
     * kind of hard connection reset that clients experience when a TAK server
     * is restarted.  The TLS listener itself stays up so that the node-tak
     * client can reconnect immediately.
     */
    restartStreaming(): void {
        for (const socket of this.streamingSockets) {
            socket.destroy();
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
