import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();
flight.user({ username: 'user1', admin: false });

test('GET: api/marti/package - impersonate', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.startsWith('/Marti/sync/search')) {
                if (!request.url.includes('tool=public')) {
                    console.log('WARN: tool=public NOT found in request url:', request.url);
                }

                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 2,
                    results: [{
                        UID: 'uid1',
                        Name: 'Pkg1',
                        Hash: 'hash1',
                        SubmissionUser: 'user1',
                        SubmissionDateTime: new Date().toISOString(),
                        EXPIRATION: new Date().toISOString(),
                        Size: 123,
                        PrimaryKey: 'pk1'
                    }, {
                        UID: 'uid2',
                        Name: 'Pkg2',
                        Hash: 'hash2',
                        SubmissionUser: 'user2',
                        SubmissionDateTime: new Date().toISOString(),
                        EXPIRATION: new Date().toISOString(),
                        Size: 456,
                        PrimaryKey: 'pk2'
                    }]
                }));
                response.end();

                return true;
            } else {
                return false;
            }
        });

        // Test impersonate=true (list all)
        const res = await flight.fetch('/api/marti/package?impersonate=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.total, 2);
        assert.equal(res.body.items.length, 2);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/package - impersonate user', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.startsWith('/Marti/sync/search')) {
                if (!request.url.includes('tool=public')) {
                    console.log('WARN: tool=public NOT found in request url:', request.url);
                }

                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    resultCount: 1,
                    results: [{
                        UID: 'uid1',
                        Name: 'Pkg1',
                        Hash: 'hash1',
                        SubmissionUser: 'user1',
                        SubmissionDateTime: new Date().toISOString(),
                        EXPIRATION: new Date().toISOString(),
                        Size: 123,
                        PrimaryKey: 'pk1'
                    }]
                }));
                response.end();

                return true;
            } else {
                return false;
            }
        });

        // Test impersonate=user1
        const res = await flight.fetch('/api/marti/package?impersonate=user1@example.com', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].username, 'user1');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
    flight.landing();
});
