import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/connection', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
            status: {
                dead: 0,
                live: 0,
                unknown: 0
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1', async () => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 404,
            message: 'Item Not Found',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.connection();

flight.landing();
