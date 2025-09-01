import test from 'tape';
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

flight.landing();
