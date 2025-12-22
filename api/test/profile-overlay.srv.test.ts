import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile/overlay', async () => {
    try {
        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
             removed: [],
             total: 0,
             items: [],
             available: {
                 terrain: false
             }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
