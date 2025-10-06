import test from 'tape';
import { FormData } from 'undici';
import fsp from 'node:fs/promises';
import Flight from './flight.js';
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
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'POST' && request.url.includes('/Marti/sync/missionupload')) {

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

        body.append('file', new Blob([file], {
            type: 'application/zip'
        }), 'SingleFeaturePackage.zip');

        // TODO Ensure that this Data Package isn't double wrapped

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
