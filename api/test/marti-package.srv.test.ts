import test from 'tape';
import busboy from 'busboy';
import { FormData } from 'undici';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Flight from './flight.js';
import { DataPackage } from '@tak-ps/node-cot';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/marti/package - empty', async (t) => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url === '/Marti/sync/search?tool=public') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 0,
                    results: []
                }));
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const res = await flight.fetch('/api/marti/package', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    flight.tak.reset();

    t.end();
});

test('POST api/marti/package - create', async (t) => {
    const outputPath = path.resolve(os.tmpdir(), randomUUID() + '.zip');

    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'POST' && request.url.includes('/Marti/sync/missionupload')) {
                await new Promise((resolve, reject) => {
                     const bb = busboy({
                         headers: request.headers,
                         limits: {
                             files: 1
                         }
                     });

                    bb.on('file', (fieldname, file) => {
                        const writeStream = fs.createWriteStream(outputPath);

                        file.pipe(writeStream);

                        writeStream.on('finish', () => {
                            resolve(true);
                        });

                        writeStream.on('error', (err) => {
                            reject(err);
                        });
                    })

                    bb.on('error', (err) => {
                        reject(err);
                    });

                    request.pipe(bb);
                });

                const dp = await DataPackage.parse(outputPath);

                t.equals(dp.settings.name, 'SingleFeaturePackage');
                t.equals(dp.contents.length, 1);
                t.ok(dp.contents[0]._attributes.zipEntry.endsWith('.cot'));

                await dp.destroy();

                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    UID: 'test',
                    SubmissionDateTime: new Date().toISOString(),
                    Keywords: ['test'],
                    MIMEType: 'application/zip',
                    SubmissionUser: 'testuser',
                    PrimaryKey: '123',
                    Hash: 'abc123',
                    CreatorUid: 'creator123',
                    Name: 'Test Package',
                }));
                response.end();

                return true;
            } else if (request.method === 'GET' && request.url.includes('/Marti/sync/search')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 1,
                    results: [{
                        UID: 'test',
                        SubmissionDateTime: new Date().toISOString(),
                        Keywords: ['test'],
                        Tool: 'public',
                        Size: 123,
                        MIMEType: 'application/zip',
                        EXPIRATION: -1,
                        SubmissionUser: 'testuser',
                        PrimaryKey: '123',
                        Hash: 'abc123',
                        CreatorUid: 'creator123',
                        Name: 'Test Package',
                    }]
                }));
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const body = new FormData();
        const file = await fsp.readFile(new URL('./data/SingleFeaturePackage.zip', import.meta.url));

        body.append('file', new Blob([new Uint8Array(file)], {
            type: 'application/zip'
        }), 'SingleFeaturePackage.zip');

        await flight.fetch('/api/marti/package', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, true);
    } catch (err) {
        t.error(err, 'no error');
    }

    flight.tak.reset();

    t.end();
});

flight.landing();
