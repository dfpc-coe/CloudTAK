import test from 'tape';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();
flight.user({ username: 'user1', admin: false });

test('GET: api/marti/package - impersonate', async (t) => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.startsWith('/Marti/sync/search')) {
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

        t.equals(res.body.total, 2);
        t.equals(res.body.items.length, 2);
    } catch (err) {
        t.error(err, 'no error');
    }

    flight.tak.reset();

    t.end();
});

test('GET: api/marti/package - impersonate user', async (t) => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url.startsWith('/Marti/sync/search')) {
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

        t.equals(res.body.items.length, 1);
        t.equals(res.body.items[0].username, 'user1');
    } catch (err) {
        t.error(err, 'no error');
    }

    flight.tak.reset();
    flight.landing();

    t.end();
});
