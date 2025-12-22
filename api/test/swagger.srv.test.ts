import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/swagger', async () => {
    try {
        const res = await flight.fetch('/api/swagger', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(res.body.info)
        assert.equal(res.body.info.title, 'CloudTAK API');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
