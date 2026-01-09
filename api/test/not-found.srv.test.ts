import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/fake/path/to/resource', async () => {
    try {
        const res = await flight.fetch('/api/fake/path/to/resource', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 404,
            message: 'API endpoint does not exist!',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
