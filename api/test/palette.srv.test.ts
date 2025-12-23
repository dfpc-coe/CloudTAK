import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/palette', async () => {
    try {
        const res = await flight.fetch('/api/palette', {
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
});

flight.landing();
