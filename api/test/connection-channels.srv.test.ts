import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

flight.connection();

test('GET: api/connection/1/channel', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=true') {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    version: 3,
                    type: 'com.bbn.marti.remote.groups.Group',
                    data: [{
                        name: 'MESA - FIRE',
                        direction: 'OUT',
                        created: '2025-06-26T16:51:41.028Z',
                        type: 'SYSTEM',
                        bitpos: 187,
                        active: true,
                        description: 'Description'
                    }],
                }));
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const res = await flight.fetch('/api/connection/1/channel', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            version: '3',
            type: 'com.bbn.marti.remote.groups.Group',
            data: [{
                name: 'MESA - FIRE',
                direction: 'OUT',
                created: '2025-06-26T16:51:41.028Z',
                type: 'SYSTEM',
                bitpos: 187,
                active: true,
                description: 'Description'
            }]
        });
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/connection/1/channel - Failure', async () => {
    try {
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) {
                return false;
            } else if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=true') {
                response.setHeader('Content-Type', 'application/json');
                response.statusCode = 500; // Simulate server error
                response.write('Internal Server Error');
                response.end();

                return true;
            } else {
                return false;
            }
        });

        const res = await flight.fetch('/api/connection/1/channel', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.deepEqual(res.status, 500);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
