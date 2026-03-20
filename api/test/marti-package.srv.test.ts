import test from 'node:test';
import assert from 'node:assert';
import { Busboy } from '@fastify/busboy';
import os from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Flight from './flight.js';
import { DataPackage } from '@tak-ps/node-cot';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/marti/package - empty', async () => {
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

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('POST api/marti/package - Upload Data Package', async () => {
    const outputPath = path.resolve(os.tmpdir(), randomUUID() + '.zip');

    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'POST' && request.url.includes('/Marti/sync/missionupload')) {
                await new Promise((resolve, reject) => {
                    const contentType = request.headers['content-type'];
                    if (!contentType) {
                        reject(new Error('Missing Content-Type Header'));
                        return;
                    }

                     const bb = new Busboy({
                         headers: {
                             'content-type': contentType
                         },
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

                assert.equal(dp.settings.name, 'SingleFeaturePackage');
                assert.equal(dp.contents.length, 1);
                assert.ok(dp.contents[0]._attributes.zipEntry.endsWith('.cot'));

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
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('POST api/marti/package - Upload KML', async () => {
    const outputPath = path.resolve(os.tmpdir(), randomUUID() + '.zip');

    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'POST' && request.url.includes('/Marti/sync/missionupload')) {
                await new Promise((resolve, reject) => {
                    const contentType = request.headers['content-type'];
                    if (!contentType) {
                        reject(new Error('Missing Content-Type Header'));
                        return;
                    }

                     const bb = new Busboy({
                         headers: {
                             'content-type': contentType
                         },
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

                assert.equal(dp.contents.length, 1);
                assert.ok(dp.contents[0]._attributes.zipEntry.endsWith('.kml'));

                const kmlContent = (await dp.getFileBuffer(dp.contents[0]._attributes.zipEntry)).toString();
                const originalKml = await fsp.readFile(new URL('./data/point.kml', import.meta.url), 'utf8');
                assert.equal(kmlContent, originalKml);

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
        const file = await fsp.readFile(new URL('./data/point.kml', import.meta.url));

        body.append('file', new Blob([new Uint8Array(file)], {
            type: 'application/vnd.google-earth.kml+xml'
        }), 'point.kml');

        await flight.fetch('/api/marti/package', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body
        }, true);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.user({ username: 'pkgowner', admin: false });

test('DELETE api/marti/package/:uid - Owner can delete own package', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.includes('/Marti/sync/search')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 1,
                    results: [{
                        UID: 'owner-pkg-uid',
                        SubmissionDateTime: new Date().toISOString(),
                        Keywords: ['test'],
                        Tool: 'public',
                        Size: 123,
                        MIMEType: 'application/zip',
                        EXPIRATION: -1,
                        SubmissionUser: 'pkgowner@example.com',
                        PrimaryKey: '456',
                        Hash: 'owner-hash-123',
                        CreatorUid: 'pkgowner',
                        Name: 'Owner Package',
                    }]
                }));
                response.end();

                return true;
            } else if (request.method === 'DELETE' && request.url.includes('/Marti/api/files/owner-hash-123')) {
                response.writeHead(200);
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const res = await flight.fetch('/api/marti/package/owner-pkg-uid?hash=owner-hash-123', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.pkgowner
            }
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            status: 200,
            message: 'Package Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('DELETE api/marti/package/:uid - Non-owner non-admin cannot delete', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.includes('/Marti/sync/search')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 1,
                    results: [{
                        UID: 'other-pkg-uid',
                        SubmissionDateTime: new Date().toISOString(),
                        Keywords: ['test'],
                        Tool: 'public',
                        Size: 123,
                        MIMEType: 'application/zip',
                        EXPIRATION: -1,
                        SubmissionUser: 'someone-else@example.com',
                        PrimaryKey: '789',
                        Hash: 'other-hash-456',
                        CreatorUid: 'someone-else',
                        Name: 'Other Package',
                    }]
                }));
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const res = await flight.fetch('/api/marti/package/other-pkg-uid?hash=other-hash-456', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.pkgowner
            }
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Insufficient Access to delete Package');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('DELETE api/marti/package/:uid - Admin can delete any package', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.includes('/Marti/sync/search')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 1,
                    results: [{
                        UID: 'any-pkg-uid',
                        SubmissionDateTime: new Date().toISOString(),
                        Keywords: ['test'],
                        Tool: 'public',
                        Size: 123,
                        MIMEType: 'application/zip',
                        EXPIRATION: -1,
                        SubmissionUser: 'someone-else@example.com',
                        PrimaryKey: '999',
                        Hash: 'any-hash-789',
                        CreatorUid: 'someone-else',
                        Name: 'Any Package',
                    }]
                }));
                response.end();

                return true;
            } else if (request.method === 'DELETE' && request.url.includes('/Marti/api/files/any-hash-789')) {
                response.writeHead(200);
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const res = await flight.fetch('/api/marti/package/any-pkg-uid?hash=any-hash-789', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            status: 200,
            message: 'Package Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
